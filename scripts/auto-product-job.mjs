import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const apiKey = process.env.NVIDA_NIM_API_KEY || process.env.NVIDIA_NIM_API_KEY;
const model = process.env.NVIDA_NIM_MODE || process.env.NVIDIA_NIM_MODEL;
const baseUrl = (process.env.NVIDIA_NIM_BASE_URL || "https://integrate.api.nvidia.com/v1").replace(/\/$/, "");
const job = process.argv[2];

const jobs = {
  qa: {
    title: "QC & QA audit",
    prompt: [
      "Act as a meticulous QC and QA lead.",
      "Audit pages, tabs, subtabs, buttons, links, navigation, sorting, ordering, filters, loading, errors, and empty-data states.",
      "Trace concrete flows from the supplied source and tests; do not invent defects.",
      "Return a prioritized Markdown backlog with severity, reproduction steps, expected versus actual behavior, affected files, acceptance criteria, and a suggested automated test.",
    ].join(" "),
  },
  ux: {
    title: "Mobile UI/UX review",
    prompt: [
      "Act as a senior mobile product designer and accessibility reviewer.",
      "Review responsive behavior at 320, 375, 768, and desktop widths, information hierarchy, touch targets, overflow, readability, keyboard and screen-reader support, and flow complexity.",
      "Recommend simplifications that reduce steps without removing essential capabilities.",
      "Return a prioritized Markdown backlog with evidence from affected files, acceptance criteria, target viewport, and a verification method.",
    ].join(" "),
  },
  po: {
    title: "Product opportunity review",
    prompt: [
      "Act as the product owner for a Solana whale and smart-money analytics product.",
      "Identify enhancement opportunities and compare the experience with useful patterns from products such as GMGN, Birdeye, DexScreener, Arkham, Nansen, and DeBank.",
      "Never claim current competitor facts unless they are verifiable from supplied context; label assumptions and items needing external validation.",
      "Return a phased Now/Next/Later Markdown roadmap with user value, competitor inspiration, effort, risk, dependencies, success metrics, acceptance criteria, and duplicate or out-of-scope ideas called out.",
    ].join(" "),
  },
  dev: {
    title: "Implementation",
    prompt: [
      "Act as a staff Next.js engineer. Implement the highest-value compatible items from the three supplied audit reports.",
      "Prefer root-cause fixes and include or update tests. Keep existing visual language and API contracts.",
      "Return exactly TITLE:, BODY:, and PATCH:. PATCH must contain one unified diff in a ```diff fenced block, touch at most eight tracked files under src/ or tests/, and apply cleanly with git apply.",
      "BODY must list implemented report items, validation guidance, and any deferred items with reasons.",
      "Never modify secrets, .env files, lockfiles, wallet signing, trade execution, or introduce synthetic market data. If no safe implementation is supported, return an empty PATCH block.",
    ].join(" "),
  },
};

if (!apiKey || !model) throw new Error("NVIDIA NIM credentials are not configured");
if (!jobs[job]) throw new Error(`Unknown auto job: ${job || "(missing)"}`);

const sourceFiles = execFileSync("git", ["ls-files", "src", "tests", "package.json", "playwright.config.ts"], { encoding: "utf8" })
  .split(/\r?\n/)
  .filter(Boolean)
  .filter((file) => /\.(?:ts|tsx|json)$/.test(file))
  .slice(0, 180);
const sourceContext = (await Promise.all(sourceFiles.map(async (file) => (
  `\n--- ${file} ---\n${await readFile(file, "utf8")}`
)))).join("").slice(0, 120_000);

let reportContext = "";
if (job === "dev") {
  reportContext = (await Promise.all(["qa", "ux", "po"].map(async (name) => {
    const report = await readFile(`auto-job-results/${name}.md`, "utf8");
    return `\n--- ${name.toUpperCase()} REPORT ---\n${report}`;
  }))).join("");
}

const response = await fetch(`${baseUrl}/chat/completions`, {
  method: "POST",
  headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    model,
    temperature: job === "dev" ? 0.1 : 0.2,
    max_tokens: job === "dev" ? 8_000 : 5_000,
    messages: [
      { role: "system", content: jobs[job].prompt },
      {
        role: "user",
        content: `Repository ${process.env.GITHUB_REPOSITORY || "unknown"} at ${process.env.GITHUB_SHA || "unknown"}.${reportContext}\n\nSOURCE CONTEXT:${sourceContext}`,
      },
    ],
  }),
});

if (!response.ok) throw new Error(`NVIDIA NIM request failed (${response.status}): ${await response.text()}`);
const payload = await response.json();
const content = payload.choices?.[0]?.message?.content?.trim();
if (!content) throw new Error("NVIDIA NIM returned an empty response");

await mkdir("auto-job-results", { recursive: true });
if (job !== "dev") {
  await writeFile(`auto-job-results/${job}.md`, `# ${jobs[job].title}\n\n${content}\n`);
  console.log(`${jobs[job].title} completed`);
} else {
  const title = content.match(/^TITLE:\s*(.+)$/m)?.[1]?.trim() || "Automated product review implementation";
  const bodyStart = content.indexOf("BODY:");
  const patchStart = content.indexOf("PATCH:");
  const body = bodyStart >= 0 && patchStart > bodyStart
    ? content.slice(bodyStart + 5, patchStart).trim()
    : "Implementation generated from the automated QA, UX, and product reviews.";
  const patch = content.slice(patchStart >= 0 ? patchStart : content.length).match(/```diff\s*([\s\S]*?)```/i)?.[1]?.trim() || "";
  await writeFile("auto-job-results/dev-title.txt", `${title}\n`);
  await writeFile("auto-job-results/dev-body.md", `${body}\n\n_Generated from the QC/QA, UI/UX, and PO auto-job reports using model \`${model}\`._\n`);
  await writeFile("auto-job-results/dev.patch", patch ? `${patch}\n` : "");
  console.log(title);
}
