/*
 * Icon registry. Pages/socials store an icon by *name* (a string) in config so
 * the data stays serializable; this maps the name → a Lucide component. The
 * Builder Portal's icon picker iterates ICON_NAMES.
 */
import {
  Home,
  Users,
  BookOpen,
  Settings,
  Shield,
  Award,
  BadgeCheck,
  ClipboardList,
  ClipboardCheck,
  FileText,
  FileSearch,
  Folder,
  Database,
  BarChart3,
  Calendar,
  Bell,
  Megaphone,
  MessageCircle,
  Link as LinkIcon,
  Map,
  Car,
  Flame,
  Stethoscope,
  Scale,
  Radio,
  Star,
  Crown,
  LayoutDashboard,
  GraduationCap,
  Wrench,
  HelpCircle,
} from "lucide-react";
import {
  Discord,
  YouTube,
  Twitch,
  Steam,
  Instagram,
  XTwitter,
  TikTok,
  Facebook,
} from "./brandIcons.jsx";

export const ICONS = {
  Home,
  Users,
  BookOpen,
  Settings,
  Shield,
  Award,
  BadgeCheck,
  ClipboardList,
  ClipboardCheck,
  FileText,
  FileSearch,
  Folder,
  Database,
  BarChart3,
  Calendar,
  Bell,
  Megaphone,
  MessageCircle,
  LinkIcon,
  Map,
  Car,
  Flame,
  Stethoscope,
  Scale,
  Radio,
  Star,
  Crown,
  LayoutDashboard,
  GraduationCap,
  Wrench,
  HelpCircle,
  // Brand / community logos
  Discord,
  YouTube,
  Twitch,
  Steam,
  Instagram,
  XTwitter,
  TikTok,
  Facebook,
};

export const ICON_NAMES = Object.keys(ICONS);

export function getIcon(name) {
  return ICONS[name] || ICONS.Folder;
}
