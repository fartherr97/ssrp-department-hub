/*
 * AI summary endpoint — backs src/lib/api.js aiAsk. Lets a reviewer ask a
 * natural-language question about an exam/feedback form's responses and get a
 * summary drawn from every submission.
 *
 *   POST /api/ai/ask  { pageId, examId, question } → { answer }
 *
 * The response data is rebuilt SERVER-SIDE from the stored config (never
 * trusted from the client) and gated by canReviewExam, so a caller can only
 * summarize responses they're allowed to review. Requires ANTHROPIC_API_KEY;
 * without it the endpoint degrades gracefully (200 with an `error` note).
 */
import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { requireAuth } from "../permissions.js";
import { resolveDepartmentId } from "../tenant.js";
import { currentConfig } from "./config.js";
import { canReviewExam, responsesToText } from "../../src/lib/exams.js";

const MAX_DATA_CHARS = 40000; // keep the prompt bounded
const MAX_QUESTION_CHARS = 500;

export function aiRouter() {
  const router = Router();

  router.post("/ai/ask", requireAuth, async (req, res, next) => {
    try {
      const { pageId, examId, question } = req.body || {};
      const q = String(question || "").slice(0, MAX_QUESTION_CHARS).trim();
      if (!q) return res.status(400).json({ ok: false, error: "A question is required" });

      const departmentId = req.departmentId || resolveDepartmentId(req);
      const config = await currentConfig(departmentId);
      const page = (config.pages || []).find((p) => p.id === pageId && p.type === "exams");
      const exam = (page?.config?.exams || []).find((e) => e.id === examId);
      if (!page || !exam) return res.status(404).json({ ok: false, error: "Form not found" });

      // Only someone allowed to review this exam's submissions may summarize them.
      if (!canReviewExam(req.user, config, exam)) {
        return res.status(403).json({ ok: false, error: "Not allowed to view these responses" });
      }

      if (!process.env.ANTHROPIC_API_KEY) {
        return res.json({
          ok: true,
          data: {
            answer: "",
            error:
              "AI summaries aren't set up on this server. An administrator needs to set the ANTHROPIC_API_KEY environment variable to enable them.",
          },
        });
      }

      let data = responsesToText(exam, page.config.submissions || []);
      let truncated = false;
      if (data.length > MAX_DATA_CHARS) {
        data = data.slice(0, MAX_DATA_CHARS);
        truncated = true;
      }

      const client = new Anthropic();
      const message = await client.messages.create({
        model: "claude-opus-4-8",
        max_tokens: 1024,
        system:
          "You help a department administrator understand responses to an internal exam or feedback form. " +
          "Answer the user's question using ONLY the response data provided. Be concise and specific: cite counts, " +
          "percentages, and recurring themes where useful, and quote a short representative response when it helps. " +
          "If the data doesn't address the question, say so plainly rather than guessing." +
          (truncated ? " Note: the response data was truncated to fit, so figures may be partial." : ""),
        messages: [
          {
            role: "user",
            content: `Here are the responses:\n\n${data}\n\n---\nQuestion: ${q}`,
          },
        ],
      });

      if (message.stop_reason === "refusal") {
        return res.json({ ok: true, data: { answer: "", error: "The AI declined to answer that question." } });
      }
      const answer = (message.content || [])
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      return res.json({ ok: true, data: { answer } });
    } catch (err) {
      // Don't 500 the UI over an upstream AI error — return a friendly note.
      const status = err?.status;
      const msg =
        status === 401
          ? "The server's AI API key is invalid."
          : status === 429
          ? "The AI service is rate-limited right now. Try again in a moment."
          : "Couldn't reach the AI service just now.";
      return res.json({ ok: true, data: { answer: "", error: msg } });
    }
  });

  return router;
}
