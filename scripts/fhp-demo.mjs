/*
 * Generates a complete Florida Highway Patrol demo config from the roster
 * screenshots. Run: node scripts/fhp-demo.mjs > fhp-demo-config.json
 * Then import the JSON via Builder → Backup & Restore.
 */
import { cloneDefaultConfig } from "../src/config/defaultConfig.js";

// ── Member columns ───────────────────────────────────────────────────────────
const memberFields = [
  { id: "callsign", label: "Callsign", type: "text" },
  {
    id: "status",
    label: "Activity",
    type: "select",
    pill: true,
    options: ["Active", "Semi-Active", "LOA", "Inactive", "N/A"],
    optionColors: {
      Active: "#1eb854",
      "Semi-Active": "#d98a1e",
      LOA: "#3d82f0",
      Inactive: "#e0556e",
      "N/A": "#6b7280",
    },
  },
  {
    id: "troop",
    label: "Troop",
    type: "select",
    options: ["Alpha","Bravo","Charlie","Delta","Echo","Foxtrot","Golf","Hotel","India","Juliet","Kilo","Lima","N/A"],
  },
  {
    id: "phase",
    label: "Training Phase",
    type: "select",
    pill: true,
    options: ["Classroom", "Academy", "Phase 1", "Phase 2", "Phase 3", "Field Training", "Complete"],
    optionColors: {
      Classroom: "#f59e0b",
      Academy: "#a855f7",
      "Phase 1": "#3b82f6",
      "Phase 2": "#3b82f6",
      "Phase 3": "#3b82f6",
      "Field Training": "#14b8a6",
      Complete: "#22c55e",
    },
  },
  { id: "prob", label: "Probation Ends", type: "date" },
  { id: "entry", label: "Date of Entry", type: "date" },
  { id: "promo", label: "Date of Promotion", type: "date" },
  { id: "tig", label: "Time In Grade", type: "text" },
  {
    id: "disc",
    label: "Disciplinary Action",
    type: "select",
    pill: true,
    options: ["N/A", "Probation", "Strike 1", "Strike 2", "Demoted"],
    optionColors: {
      "N/A": "#4b5563",
      Probation: "#c99a3a",
      "Strike 1": "#dc2626",
      "Strike 2": "#b91c1c",
      Demoted: "#2563eb",
    },
  },
  { id: "staff", label: "Server Staff/Dev", type: "checkbox" },
  { id: "ftoCert", label: "FTO/FTA Cert", type: "cert" },
  { id: "intCert", label: "Interview Cert", type: "cert" },
  { id: "acadCert", label: "Academy Instructor Cert", type: "cert" },
];

// ── Helpers ──────────────────────────────────────────────────────────────────
const A = { A: "Active", S: "Semi-Active", L: "LOA", I: "Inactive", N: "N/A" };
const TR = { A:"Alpha",B:"Bravo",C:"Charlie",D:"Delta",E:"Echo",F:"Foxtrot",G:"Golf",H:"Hotel",I:"India",J:"Juliet",K:"Kilo",L:"Lima",N:"N/A" };
const iso = (d) => {
  if (!d) return "";
  const [m, day, y] = d.split("/");
  return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};
// this-year probation "7/7" → 2026-07-07
const probIso = (p) => {
  if (!p) return "";
  if (p.includes("/") && p.split("/").length === 3) return iso(p);
  const [m, day] = p.split("/");
  return `2026-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

let uidN = 1;
const uid = () => `m${(uidN++).toString(36)}`;

// m(callsign, name, rank, act, troop, entry, promo, prob, tig, discord, disc, certs)
function m(cs, name, rank, act, troop, entry, promo, prob, tig, discord, disc, certs = "") {
  return {
    id: uid(),
    name,
    rank, // filled to a rank id later
    _rankName: rank,
    discordId: discord || "",
    fields: {
      callsign: cs || "",
      status: A[act] || "",
      troop: TR[troop] || "",
      prob: probIso(prob),
      entry: iso(entry),
      promo: iso(promo),
      tig: tig != null ? String(tig) : "",
      disc: disc || "N/A",
      staff: certs.includes("s"),
      ftoCert: certs.includes("f"),
      intCert: certs.includes("i"),
      acadCert: certs.includes("a"),
    },
  };
}

// ── Members by grade (category) ──────────────────────────────────────────────
const commandStaff = [
  m("9100","P. Johnson","Colonel","A","","3/4/2024","4/7/2026","7/7",85,"557582369897316352","Probation","sfia"),
  m("9101","B. Jamison","Lt. Colonel","A","","11/1/2024","4/7/2026","7/7",85,"936056084764975114","Probation","sfia"),
];

const commandGrade = [
  m("9201","Greg","Major - Administration Bureau","A","","6/9/2026","6/9/2026","7/9",22,"989253436463784026","Probation","sfia"),
  m("9202","Hanson","Major - Operations Bureau","A","","5/28/2026","5/28/2026","5/28/2026",34,"541318979952836643","Probation","sfi"),
  m("9203","M. Pineapple","Captain - IA & PAO","A","","4/12/2025","2/10/2026","",141,"409912391602667520","N/A","sfia"),
  m("9204","Greyrat","Captain - Training & HR","A","","12/22/2025","2/12/2026","",139,"295030424676335618","N/A","fia"),
  m("9205","A. Barkley","Captain - Special Operations","A","","12/31/2025","4/16/2026","",76,"124795997209283847","N/A","sfia"),
  m("9206","J. Welch","Captain - Patrol Operations A","A","","10/15/2025","6/7/2026","",24,"1313711587521073152","N/A","sfi"),
  m("9207","Lee","Captain - Patrol Operations B","N","","2/18/2026","6/29/2026","7/13",2,"766805847657414686","Probation","sfia"),
  m("9208","C. Cervantes","Captain - Patrol Operations C","A","","12/21/2025","4/16/2026","",76,"586315472136437760","N/A","sfia"),
  m("9209","B. Diano","Lieutenant - Internal Affairs Bureau","A","","11/29/2025","6/9/2026","",22,"286273578029023232","N/A","fi"),
  m("9210","Moore","Lieutenant - Training Division A","A","","11/29/2025","4/16/2026","",76,"1058221198250627082","N/A","sfi"),
  m("9211","J. Hanes","Lieutenant - Training Division B","A","","12/5/2025","3/29/2026","",94,"1160048327954546769","N/A","sfia"),
  m("9212","Hoot","Lieutenant - Human Resources","A","","11/1/2025","3/29/2026","",94,"219960033511866369","N/A","sfi"),
  m("9213","C. Dawson","Lieutenant - Special Operations","A","","10/31/2025","6/7/2026","",24,"881692339398123592","N/A","sf"),
  m("9214","Oshelski","Lieutenant - Patrol Operations A","A","","5/18/2026","5/18/2026","",44,"696470941689184308","N/A","sfi"),
  m("9215","A. Densmore","Lieutenant - Patrol Operations B","A","","5/31/2026","6/29/2026","7/13",2,"423963189756166144","Probation","fi"),
  m("9216","R. Rowdy","Lieutenant - Patrol Operations C","A","","7/20/2025","6/29/2026","",24,"415002463008194570","N/A","sfia"),
  m("9217","Wilson","Lieutenant - Patrol Operations D","A","","6/15/2026","6/29/2026","7/13",2,"284401499159789568","Probation","fi"),
  m("9218","M. Double","Lieutenant - Patrol Operations E","A","","11/27/2026","4/16/2026","",76,"753151402079158373","N/A","sfia"),
  m("9219","J. Rogue","Lieutenant - Patrol Operations F","A","","6/9/2025","1/23/2026","",159,"585810454274768918","N/A","sfia"),
];

const supervisorGrade = [
  m("9301","D. Pierce","Master Sergeant - SRT","A","","1/4/2026","4/2/2026","",90,"767102557319069706","N/A","fia"),
  m("9302","B. Wagner","Sergeant - CRRO","A","","3/25/2026","6/9/2026","",22,"748985899684986885","N/A","fi"),
  m("9303","","Sergeant - CIU","N","","","","",null,"","N/A",""),
  m("9304","J. Lockee","Sergeant - Florida FWC","A","","4/29/2026","6/19/2026","7/3",12,"564329203080826176","Probation","sfia"),
  m("9305","S. Kelly","Sergeant - Training Divison","A","","5/6/2026","6/15/2026","",16,"303953705785491458","Strike 1","fia"),
  m("9306","D. Sabr","Master Sergeant - Training Divison","L","","2/18/2026","4/21/2026","",71,"901860517830860930","N/A","fia"),
  m("9307","Rocco","Sergeant - Training Divison","A","","5/17/2026","6/18/2026","7/2",13,"963281582469292073","Probation","sfia"),
  m("9308","B. White","Sergeant - Training Divison","A","","4/7/2026","6/11/2026","",20,"276904367855239169","N/A","fi"),
  m("9310","G. Thind","Staff Sergeant - Human Resources","A","","1/11/2026","5/11/2026","",51,"1253143404615827538","N/A","fia"),
  m("9311","B. Sterling","Staff Sergeant - Human Resources","A","","1/11/2026","5/11/2026","",51,"570751604337410048","N/A","fi"),
  m("9312","N. Boyett","Sergeant - Human Resources","A","","1/24/2026","6/18/2026","7/2",13,"1067181723936362498","Probation","fi"),
  m("9313","","Sergeant - Public Affairs Officer","N","","","","",null,"","N/A",""),
  m("9314","D. King","Sergeant - Internal Affairs","A","","3/17/2026","6/10/2026","",21,"441047992955305986","N/A","fi"),
  m("9315","E. Wright","Sergeant - Internal Affairs","A","","4/17/2026","6/13/2026","",18,"262109889638301697","N/A","fi"),
  m("9316","T. Pack","Staff Sergeant - Alpha Troop","A","","9/30/2025","5/28/2026","",34,"236227982555873285","N/A","fi"),
  m("9317","S. Jackson","Master Sergeant - Bravo Troop","L","","7/21/2025","2/4/2026","",147,"590606529015578637","N/A","sfia"),
  m("9318","","Master Sergeant - Charlie Troop","N","","","","",null,"","N/A",""),
  m("9319","K. Hernandez","Staff Sergeant - Delta Troop","L","","2/14/2026","5/18/2026","",44,"1445564454360062654","N/A","fi"),
  m("9320","R. Rider","Sergeant - Echo Troop","A","","6/14/2026","6/14/2026","",17,"1449435127317921907","N/A","fi"),
  m("9321","C. Rodriguez","Sergeant - Foxtrot Troop","A","","3/12/2026","6/10/2026","",21,"679630507780210722","N/A","fi"),
  m("9322","B. Wright","Sergeant - Golf Troop","A","","6/22/2026","6/29/2026","7/13",1,"1462652314623017063","Probation","fi"),
  m("9323","C. OStrong","Master Sergeant - Hotel Troop","A","","1/11/2026","4/26/2026","",66,"663191158167437313","N/A","fi"),
  m("9324","B. Witty","Master Sergeant - India Troop","A","","8/10/2025","4/2/2026","",90,"780994871888183347","N/A","fi"),
  m("9325","J. Hicks","Sergeant - Juliet Troop","A","","12/27/2025","6/10/2026","",21,"400447367939227679","N/A","fi"),
  m("9326","E. Rodriguez","Master Sergeant - Kilo Troop","A","","1/18/2026","4/26/2026","",66,"1203754785891680267","N/A","fi"),
  m("9327","K. Jackson","Staff Sergeant - Lima Troop","A","","1/18/2026","5/17/2026","",45,"474657155681615872","N/A","fi"),
  m("9328","","Sergeant - Special Liaison","N","","","","",null,"","N/A",""),
];

const juniorSupervisor = [
  m("9330","M. Fisher","Senior Corporal - Alpha Troop","A","","5/22/2026","5/22/2026","",40,"604023031643373588","N/A","f"),
  m("9331","C. Beck","Corporal - Alpha Troop","A","","6/30/2026","6/30/2026","7/14",1,"186135604164165633","Probation",""),
  m("9332","L. Critchley","Corporal - Bravo Troop","A","","2/8/2026","6/29/2026","7/13",2,"774749655882899968","Probation","f"),
  m("9333","H. Mack","Corporal - Bravo Troop","A","","6/21/2026","6/21/2026","7/5",10,"644638626092679170","Probation","f"),
  m("9334","","Corporal - Charlie Troop","N","","","","",null,"","N/A",""),
  m("9335","J. Stevens","Master Corporal - Charlie Troop","I","","6/21/2026","5/27/2026","",35,"476887599324200980","N/A","f"),
  m("9336","J. Pearson","Corporal - Delta Troop","A","","4/7/2026","6/29/2026","7/13",2,"557574078035394571","Probation","f"),
  m("9337","N. Lopez","Corporal - Delta Troop","A","","4/27/2026","6/29/2026","7/13",2,"593172904879849482","Probation","f"),
  m("9338","J. Lazlo","Corporal - Echo Troop","A","","11/11/2025","6/10/2026","",21,"597621322335387650","Probation","f"),
  m("9339","Carson","Corporal - Echo Troop","A","","6/15/2026","6/29/2026","7/13",2,"115963539990852820","Probation","f"),
  m("9340","D. Montrel","Corporal - Foxtrot Troop","A","","5/10/2026","6/10/2026","",21,"1195550886785728635","Strike 2","f"),
  m("9341","","Corporal - Foxtrot Troop","N","","","","",null,"","N/A",""),
  m("9342","T. Herndon","Master Corporal - Golf Troop","A","","9/6/2025","1/14/2026","",168,"1217887313032384614","N/A","f"),
  m("9343","","Corporal - Golf Troop","N","","","","",null,"","N/A",""),
  m("9344","K. Young","Senior Corporal - Hotel Troop","A","","2/20/2026","5/19/2026","",43,"703336830420675989","N/A","f"),
  m("9345","","Corporal - Hotel Troop","N","","","","",null,"","N/A",""),
  m("9346","M. Savage","Senior Corporal - India Troop","A","","5/16/2026","5/16/2026","",46,"997226121198325831","N/A","f"),
  m("9347","M. Jenson","Corporal - India Troop","A","","6/21/2026","6/21/2026","7/5",10,"1015799162731757659","Probation","sf"),
  m("9348","J. Gibson","Corporal - Juliet Troop","L","","6/19/2026","6/19/2026","7/3",12,"881435482406400010","Probation","f"),
  m("9349","","Corporal - Juliet Troop","N","","","","",null,"","N/A",""),
  m("9350","D. Bailey","Corporal - Kilo Troop","A","","6/19/2026","6/19/2026","7/3",12,"520721057024442369","Probation","f"),
  m("9351","Rodriguez","Corporal - Kilo Troop","A","","6/20/2026","6/20/2026","7/4",11,"993641174986412082","Probation","f"),
  m("9352","J. Martinez","Corporal - Lima Troop","A","","1/13/2026","6/10/2026","",43,"220328592809132033","N/A","f"),
  m("9353","N. Dash","Corporal - Lima Troop","A","","5/4/2026","6/29/2026","7/13",2,"841688268080021505","Probation","f"),
];

const masterTroopers = [
  m("9401","Jones","Master Trooper","A","E","4/4/2026","6/10/2026","",21,"799745028138336336","N/A","f"),
  m("9402","Feldman","Master Trooper","A","K","5/17/2026","5/17/2026","",45,"257653016675614732","N/A","f"),
  m("9403","B. Davis","Master Trooper","S","B","1/12/2026","5/19/2026","",43,"958490609264508970","N/A","f"),
  m("9404","I. Doherty","Master Trooper","L","B","2/10/2025","6/9/2026","",22,"989253436463784026","N/A","f"),
  m("9405","Erick","Master Trooper","A","F","4/5/2026","6/30/2026","7/14",1,"293144891595292672","N/A","f"),
  m("9406","C. Enzo","Master Trooper","A","E","4/7/2026","6/10/2026","",21,"401829404218753025","Strike 1","f"),
  m("9407","Foster","Master Trooper","A","B","6/9/2026","6/9/2026","",22,"1182462649624166481","N/A","f"),
  m("9408","H. West","Master Trooper","A","G","6/5/2026","6/29/2026","7/13",2,"335158287433596948","N/A","f"),
  m("9409","W. Smith","Master Trooper","A","E","4/28/2026","6/29/2026","7/13",2,"1362541949415985422","N/A","f"),
  m("9410","M. Smith","Master Trooper","A","C","4/29/2023","12/8/2025","",205,"689265745179443331","N/A","f"),
  m("9411","Fit","Master Trooper","A","K","6/6/2026","6/10/2026","",21,"408391185602969602","N/A","f"),
  m("9412","J. Mountain","Master Trooper","A","E","4/7/2026","6/10/2026","",21,"530957139762610188","Strike 1","f"),
  m("9413","Loom","Master Trooper","A","H","5/11/2026","5/11/2026","",51,"1040707048087769119","N/A","f"),
  m("9414","M. Richards","Master Trooper","A","I","2/7/2026","6/29/2026","7/13",2,"876788053132328961","Probation","f"),
  m("9415","Warner","Master Trooper","I","J","3/22/2026","3/22/2026","",101,"321387442701729802","N/A","f"),
  m("9416","N. Seymour","Master Trooper","S","I","3/22/2026","6/15/2026","",16,"725692129996832780","Probation","f"),
  m("9417","T. Homer","Master Trooper","A","J","4/12/2026","6/29/2026","7/13",2,"1209318994784428053","Probation","f"),
  m("9418","J. Sander","Master Trooper","A","D","1/26/2026","6/29/2026","7/10",5,"864258765511589908","Probation","f"),
  m("9419","L. Gibson","Master Trooper","A","C","6/28/2026","6/28/2026","7/12",3,"786431466007298051","Probation","f"),
  m("9420","J. Farson","Master Trooper","A","G","6/19/2026","6/29/2026","7/13",2,"212709542356713472","Strike 1","f"),
  m("9421","J. Phillips","Master Trooper","A","I","6/23/2026","6/29/2026","7/13",2,"805710656002850827","Probation","f"),
  m("9422","F. Sulvano","Master Trooper","A","E","4/25/2026","6/10/2026","",21,"981533917377089557","N/A","f"),
  m("9423","C. Walker","Master Trooper","A","G","5/3/2026","6/29/2026","7/13",2,"525103316888322059","Probation","f"),
  m("9424","A. Mathieu","Master Trooper","A","A","3/26/2026","6/10/2026","",21,"595382513317314570","N/A","f"),
  m("9425","Zero","Master Trooper","A","G","3/21/2026","3/21/2026","",102,"139885962007281664","N/A","f"),
  m("9426","J. Brown","Master Trooper","A","F","6/19/2026","6/19/2026","7/3",12,"994648093138092102","Probation","sf"),
  m("9427","A. Colt","Master Trooper","A","L","6/20/2026","6/20/2026","7/4",11,"1309005710734131203","Probation","f"),
  m("9428","M. Turner","Master Trooper","A","C","6/21/2026","6/21/2026","7/5",10,"1329987932685074555","Probation","f"),
  m("9429","M. Rivera","Master Trooper","A","L","6/26/2026","6/26/2026","7/10",5,"374449601924562944","Probation","f"),
  m("9430","J. Royal","Master Trooper","A","C","4/16/2026","6/29/2026","7/13",2,"1033204359040876595","Probation","f"),
  m("9431","T. Wilson","Master Trooper","A","B","5/4/2026","6/29/2026","7/13",2,"1357464850938200067","Probation","f"),
  m("9432","Roberts","Master Trooper","A","G","5/11/2026","6/29/2026","7/13",2,"955988890618048562","Probation","f"),
  m("9433","P. Reynolds","Master Trooper","A","F","3/31/2026","6/29/2026","7/13",2,"1331038294947139587","Probation","f"),
  m("9434","R. Flores","Master Trooper","A","I","3/31/2026","6/29/2026","7/13",2,"1035621055387156480","Probation","f"),
  m("9435","Russell R.","Master Trooper","A","J","4/30/2026","6/29/2026","7/13",2,"771803862322511883","Probation","f"),
  m("9436","K. Morgan","Master Trooper","A","F","4/25/2026","6/29/2026","7/13",2,"669675053293502524","Probation","f"),
];

const seniorTroopers = [
  m("9451","Highton","Senior Trooper","A","G","5/1/2026","6/25/2026","",28,"448953964390514688","Demoted","f"),
  m("9452","Z. Papp","Senior Trooper","A","G","5/20/2026","6/29/2026","",2,"1445484170976559105","N/A","f"),
  m("9453","","Senior Trooper","N","N","","","",null,"","N/A",""),
  m("9454","Z. Muller","Senior Trooper","A","C","5/19/2026","6/29/2026","",2,"533843529949249537","N/A",""),
  m("9455","K. Reagan","Senior Trooper","A","A","5/22/2026","5/22/2026","",40,"264393972317814784","N/A",""),
  m("9456","B. Graves","Senior Trooper","A","H","4/1/2026","6/26/2026","",5,"715426553173114920","N/A","f"),
  m("9457","J. Byrd","Senior Trooper","A","J","5/23/2026","6/29/2026","",2,"964297406059515935","N/A",""),
  m("9458","Jose B.","Senior Trooper","A","G","3/22/2026","3/22/2026","",101,"1453816356553363557","N/A",""),
  m("9459","M. Briggs","Senior Trooper","A","C","5/25/2026","6/29/2026","",2,"800602502814367745","N/A",""),
  m("9460","J. Dallas","Senior Trooper","I","G","2/10/2026","4/6/2026","",86,"476274566944129025","N/A",""),
  m("9461","B. Bourne","Senior Trooper","A","B","2/8/2026","4/26/2026","",66,"694740211896156241","N/A","f"),
  m("9462","S. Huber","Senior Trooper","A","E","6/20/2026","6/29/2026","",2,"606257454006927361","N/A",""),
  m("9463","J. Richards","Senior Trooper","A","L","6/17/2026","6/17/2026","7/1",14,"814203429064146994","Probation","f"),
  m("9464","B. Zeke","Senior Trooper","S","F","4/28/2026","4/28/2026","",64,"326566880019472394","N/A",""),
  m("9465","S. Rivers","Senior Trooper","S","K","1/19/2026","3/2/2026","",121,"656537885738008606","N/A",""),
  m("9466","B. Waterson","Senior Trooper","A","F","6/14/2026","6/14/2026","6/28",17,"1300904474377715834","Probation","f"),
  m("9467","T. Bogutski","Senior Trooper","A","L","5/7/2026","6/29/2026","",2,"219949817638420482","N/A",""),
  m("9468","Antonio L.","Senior Trooper","I","J","12/5/2025","3/2/2026","",121,"794776627787595778","N/A","f"),
  m("9469","A. Pius","Senior Trooper","A","C","5/11/2026","6/29/2026","",2,"327308682876420096","N/A",""),
  m("9470","T. Brothers","Senior Trooper","A","B","4/21/2026","6/10/2026","",21,"890785229571239957","N/A",""),
  m("9471","J. Edwards","Senior Trooper","A","A","6/20/2026","6/20/2026","7/4",11,"442505838507327499","Probation","f"),
  m("9472","D. Gray","Senior Trooper","A","I","5/8/2026","6/29/2026","",2,"1022106066701529091","N/A",""),
  m("9473","L. Carter","Senior Trooper","A","A","3/17/2026","4/26/2026","",66,"390628317742759968","N/A","f"),
  m("9474","J. Grenadine","Senior Trooper","A","C","6/22/2026","6/22/2026","7/6",9,"363855573644122123","Probation","f"),
  m("9475","J. Will","Senior Trooper","A","A","5/18/2026","6/29/2026","",2,"708059499444961423","N/A",""),
  m("9476","S. Stevens","Senior Trooper","A","A","4/28/2026","4/28/2026","",64,"656721903175598114","N/A",""),
  m("9477","L. Davis","Senior Trooper","A","C","5/4/2026","6/10/2026","",21,"275482270922440704","N/A",""),
  m("9478","L. Holz","Senior Trooper","A","F","6/25/2026","6/29/2026","",2,"1080706181200359424","N/A",""),
  m("9479","J. Sander","Senior Trooper","A","J","4/2/2026","6/29/2026","",2,"521109375780126735","N/A",""),
  m("9480","T. Deatherage","Senior Trooper","A","H","4/12/2026","6/10/2026","",21,"454410793518366723","N/A",""),
  m("9481","Williams","Senior Trooper","A","D","4/14/2026","5/19/2026","",43,"829501606672334898","N/A","i"),
  m("9482","C. Alex","Senior Trooper","A","L","4/26/2026","6/10/2026","",21,"1397902470679760917","N/A",""),
  m("9483","D. Section","Senior Trooper","A","H","3/23/2026","5/19/2026","",43,"1098110082895581247","N/A",""),
  m("9484","K. Lonng","Senior Trooper","L","D","3/27/2026","5/19/2026","",43,"1010254836530434108","N/A","i"),
  m("9485","D. Falcon","Senior Trooper","A","D","12/13/2025","6/10/2026","",21,"716825670368788968","N/A",""),
  m("9486","M. Hula","Senior Trooper","A","G","4/29/2026","5/19/2026","",43,"1297226219191795722","N/A",""),
  m("9487","T. Brown","Senior Trooper","A","H","4/2/2026","4/26/2026","",66,"1190605194510213216","N/A",""),
  m("9488","J. Don","Senior Trooper","A","H","6/29/2026","6/29/2026","7/13",2,"822908364731449425","Probation",""),
  m("9489","H. Hicks","Senior Trooper","A","F","5/24/2026","6/10/2026","",21,"1180167933817786370","N/A",""),
  m("9491","M. King","Senior Trooper","A","L","4/26/2026","6/10/2026","",21,"1414291213594529934","N/A",""),
  m("9492","M. Bennett","Senior Trooper","A","J","6/20/2026","6/20/2026","7/4",11,"757687189051015268","Probation",""),
  m("9493","H. Smith","Senior Trooper","A","H","6/20/2026","6/20/2026","7/4",11,"622985643840110592","Probation",""),
  m("9495","G. Johnson","Senior Trooper","A","K","6/25/2026","6/25/2026","",6,"1234237133691162775","Probation",""),
];

const tfc = [
  m("9501","D. Johnson","Trooper First Class","A","E","6/14/2026","6/29/2026","7/13",2,"792057484600410123","N/A",""),
  m("9502","J. Rodgers","Trooper First Class","A","I","5/20/2026","6/10/2026","",21,"200054092695994369","Strike 1",""),
  m("9503","A. West","Trooper First Class","A","K","4/28/2026","5/19/2026","",43,"1300232925802926191","N/A",""),
  m("9504","T. Moore","Trooper First Class","A","D","6/21/2026","6/29/2026","7/13",2,"781807521827913748","N/A",""),
  m("9505","D. Winters","Trooper First Class","A","C","6/15/2026","6/29/2026","7/13",2,"302937946401800194","N/A",""),
  m("9506","J. Darlo","Trooper First Class","A","J","5/21/2026","6/10/2026","",21,"987149662584733736","N/A",""),
  m("9507","C. Reed","Trooper First Class","L","D","5/22/2026","6/10/2026","",21,"303593155163324416","N/A",""),
  m("9508","M. Williams","Trooper First Class","A","I","6/14/2026","6/29/2026","7/13",2,"105939135712015152","Probation",""),
  m("9509","F. Perriwinkle","Trooper First Class","S","H","1/6/2026","2/7/2026","",144,"978384777344339998","N/A",""),
  m("9510","J. Mock","Trooper First Class","A","K","6/1/2026","6/29/2026","7/13",2,"1263615568200597637","N/A",""),
  m("9511","N. James","Trooper First Class","A","B","6/8/2026","6/29/2026","7/13",2,"780208657009868810","N/A",""),
  m("9512","L. Hood","Trooper First Class","A","A","5/25/2026","6/29/2026","7/13",2,"600445892138500157","N/A",""),
  m("9513","A. Aguayo","Trooper First Class","A","J","4/12/2026","4/26/2026","",66,"881738849305366580","N/A",""),
  m("9514","D. Baker","Trooper First Class","A","B","5/27/2026","6/29/2026","7/13",2,"602464122910801930","N/A",""),
  m("9515","H. Dewitt","Trooper First Class","A","C","5/28/2026","6/29/2026","7/13",2,"1106429787100151808","N/A",""),
  m("9516","J. Waston","Trooper First Class","A","H","5/30/2026","6/29/2026","7/13",2,"173150559782567936","N/A",""),
  m("9517","Maxwell","Trooper First Class","A","D","5/14/2026","6/10/2026","",21,"590599085325680642","N/A",""),
  m("9518","E. David","Trooper First Class","L","K","5/18/2026","6/10/2026","",21,"881700783693918259","N/A",""),
  m("9519","R. Carson","Trooper First Class","A","H","2/23/2026","4/26/2026","",66,"1055531006472790107","N/A",""),
  m("9520","D. Kelley","Trooper First Class","L","G","5/30/2026","6/29/2026","7/13",2,"1297593044463255635","N/A",""),
  m("9521","A. Green","Trooper First Class","A","G","6/5/2026","6/29/2026","7/13",2,"1095110824504336444","Probation",""),
  m("9522","J. Swain","Trooper First Class","A","J","6/5/2026","6/29/2026","7/13",2,"661104318834796554","N/A",""),
  m("9523","D. Torez","Trooper First Class","I","D","3/6/2026","3/19/2026","",104,"789662354097831946","N/A",""),
  m("9524","Terk","Trooper First Class","A","B","5/8/2026","6/29/2026","7/13",2,"1108171204629639329","N/A",""),
  m("9525","R. Stark","Trooper First Class","A","F","5/28/2026","6/29/2026","7/13",2,"395575920454520013","N/A",""),
  m("9526","J. Beckett","Trooper First Class","A","L","4/14/2026","4/14/2026","",78,"455828842498490369","N/A",""),
  m("9527","M. Bridges","Trooper First Class","A","D","3/28/2026","4/26/2026","",66,"110919586969813062","N/A",""),
  m("9528","A. Miller","Trooper First Class","A","K","6/8/2026","6/30/2026","",22,"1189624164957569074","N/A",""),
];

const troopers = [
  m("9603","W. Jones","Trooper","I","D","1/29/2026","2/1/2026","",150,"675165822783586324","N/A",""),
  m("9606","L. Frost","Trooper","A","D","6/23/2026","6/23/2026","7/7",8,"196802783863635970","Probation",""),
  m("9607","A. Price","Trooper","A","E","6/27/2026","6/27/2026","7/11",4,"923407859532841000","Probation",""),
  m("9608","J. Rodriguez","Trooper","A","A","6/27/2026","6/27/2026","7/11",4,"212034854915801000","N/A",""),
  m("9609","R. Cessario","Trooper","S","B","5/22/2026","5/22/2026","",40,"678732376716607489","N/A",""),
  m("9610","R. Smith","Trooper","A","B","6/28/2026","6/28/2026","7/12",3,"1429911631420461086","N/A",""),
  m("9611","S. Erwin","Trooper","A","I","5/24/2026","5/24/2026","",38,"1146309992799019049","N/A",""),
  m("9612","J. Smith","Trooper","S","A","3/15/2026","3/24/2026","",99,"1116871423273742426","N/A",""),
  m("9613","J. James","Trooper","A","F","6/29/2026","6/29/2026","7/13",2,"739367411211436000","Probation",""),
  m("9621","R. Dickson","Trooper","A","A","5/26/2026","5/26/2026","",36,"915796115079725117","N/A",""),
  m("9622","M. Hatala","Trooper","A","J","4/19/2026","4/19/2026","",73,"1022762718186459157","N/A",""),
  m("9623","B. Rodriguez","Trooper","A","L","5/26/2026","5/26/2026","",36,"483029315802365953","N/A",""),
  m("9628","A. Hernandez","Trooper","A","I","5/27/2026","5/27/2026","",35,"1039012262272319579","N/A",""),
  m("9631","A. Robert","Trooper","A","E","5/28/2026","5/28/2026","",34,"1164415367532265573","N/A",""),
  m("9634","M. Mercer","Trooper","A","A","5/6/2026","5/6/2026","",56,"824809066400055379","N/A",""),
  m("9640","K. Rider","Trooper","A","B","5/30/2026","5/30/2026","",32,"418267318762864640","N/A",""),
  m("9641","J. Meiring","Trooper","A","I","5/7/2026","5/7/2026","",55,"140440630391656040","N/A",""),
  m("9646","J. Payne","Trooper","L","F","5/16/2026","5/16/2026","",46,"998432290503929906","N/A",""),
  m("9648","J. Diesel","Trooper","S","J","5/7/2026","5/7/2026","",55,"486293667741696001","N/A",""),
  m("9649","T. Thompson","Trooper","A","K","5/7/2026","5/7/2026","",55,"833878190509916191","N/A",""),
  m("9651","L. Zane","Trooper","A","A","5/9/2026","5/9/2026","",53,"624808901178687511","N/A",""),
];

const auxiliary = [
  m("9696","R. Fiddle","Auxiliary Trooper","A","K","6/8/2026","6/8/2026","",23,"1459653301074264136","N/A",""),
];

const recruits = [
  m("9901","J. Conway","Recruit","A","","6/16/2026","","6/30",null,"1370480168115760000","N/A",""),
  m("9902","T. Jones","Recruit","A","","6/17/2026","","7/1",null,"1003409298606530000","N/A",""),
  m("9903","J. Tyler","Recruit","A","","6/29/2026","","7/13",null,"1168720657098481764","N/A",""),
  m("9904","A. Luna","Recruit","A","","6/19/2026","","7/3",null,"551420102885638000","N/A",""),
  m("9905","J. Walker","Recruit","A","","6/28/2026","","7/12",null,"873965509748617297","N/A",""),
  m("9906","H. Specter","Recruit","A","","6/24/2026","","7/8",null,"645346627665526785","N/A",""),
  m("9910","M. Vasquez","Recruit","A","","6/25/2026","","7/9",null,"1121571529650606110","N/A",""),
  m("9911","N. Thomas","Recruit","A","","6/26/2026","","7/10",null,"675564425327149056","N/A",""),
];
// Demo: spread recruits across the training phases.
const PHASES = ["Classroom", "Academy", "Phase 1", "Phase 2", "Phase 3", "Field Training"];
recruits.forEach((r, i) => { r.fields.phase = PHASES[i % PHASES.length]; });

const applicants = [
  m("", "K. Marsh", "Applicant", "A", "", "6/28/2026", "", "", null, "1290000000000000001", "N/A", ""),
  m("", "T. Vale", "Applicant", "A", "", "6/29/2026", "", "", null, "1290000000000000002", "N/A", ""),
  m("", "R. Kestrel", "Applicant", "A", "", "6/30/2026", "", "", null, "1290000000000000003", "N/A", ""),
];

const categories = [
  { name: "Command Staff", color: "#d4af37", members: commandStaff },
  { name: "Command Grade", color: "#f59e0b", members: commandGrade },
  { name: "Supervisor Grade", color: "#3b82f6", members: supervisorGrade },
  { name: "Junior Supervisor Grade", color: "#14b8a6", members: juniorSupervisor },
  { name: "Trooper Grade", color: "#22c55e", members: [...masterTroopers, ...seniorTroopers, ...tfc, ...troopers, ...auxiliary] },
  { name: "Department Recruits", color: "#a855f7", members: recruits },
  { name: "Department Applicants", color: "#64748b", members: applicants },
];

// ── Build rank list (unique, in appearance order) ────────────────────────────
const rankOrder = [];
for (const c of categories) for (const mm of c.members) {
  if (!rankOrder.includes(mm._rankName)) rankOrder.push(mm._rankName);
}
const ranks = rankOrder.map((name, i) => ({ id: `fhp-rank-${i}`, name, insigniaUrl: "" }));
const rankId = Object.fromEntries(ranks.map((r) => [r.name, r.id]));
for (const c of categories) for (const mm of c.members) {
  mm.rank = rankId[mm._rankName];
  delete mm._rankName;
}

// ── Assemble config ──────────────────────────────────────────────────────────
const cfg = cloneDefaultConfig();
cfg.branding = {
  ...cfg.branding,
  name: "Florida Highway Patrol",
  shortName: "FHP",
  organization: "FHP",
  loginHeadline: "Florida Highway Patrol",
  loginSubtext: "Department Hub",
  colors: { ...cfg.branding.colors, primary: "#1f3a5f", hover: "#274b7a" },
};
cfg.roster = {
  ...cfg.roster,
  memberFields,
  stats: {
    show: true,
    items: [
      { id: "st-total", label: "Members", mode: "total" },
      { id: "st-active", label: "Active", mode: "status", statusValue: "Active" },
      { id: "st-loa", label: "LOA", mode: "status", statusValue: "LOA" },
      { id: "st-fto", label: "FTO Certified", mode: "cert", fieldId: "ftoCert" },
    ],
  },
  subdivisions: [
    {
      id: "sub-fhp",
      name: "Florida Highway Patrol",
      main: true,
      accent: "#1f3a5f",
      banner: { title: "Florida Highway Patrol", subtitle: "Department Roster" },
      ranks,
      categories: categories.map((c, i) => ({
        id: `fhp-cat-${i}`,
        name: c.name,
        color: c.color,
        insigniaUrl: "",
        members: c.members,
      })),
    },
  ],
};

const total = categories.reduce((n, c) => n + c.members.length, 0);
process.stderr.write(`FHP demo: ${total} members, ${ranks.length} ranks, ${categories.length} categories\n`);
process.stdout.write(JSON.stringify(cfg, null, 2));
