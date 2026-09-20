import { spawnSync } from "node:child_process";
import process from "node:process";

const skipValue = process.env.PUBLICATION_BUILDER_SKIP_PRINT_TOOLS;
const isWindows = process.platform === "win32";

const hasCommand = (command) => {
  const lookup = isWindows ? "where" : "which";
  const result = spawnSync(lookup, [command], { stdio: "ignore" });
  return result.status === 0;
};

const run = (command, args) => {
  const result = spawnSync(command, args, { stdio: "inherit" });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} exited with code ${result.status}`);
  }
};

const installWithChocolatey = (packages) => {
  run("choco", ["install", ...packages, "-y"]);
};

const installWithScoop = (packages) => {
  run("scoop", ["install", ...packages]);
};

const installWithWinget = (packageIds) => {
  for (const packageId of packageIds) {
    run("winget", [
      "install",
      "--id",
      packageId,
      "--exact",
      "--source",
      "winget",
      "--silent",
      "--accept-package-agreements",
      "--accept-source-agreements",
      "--disable-interactivity"
    ]);
  }
};

const missingTools = () => {
  const missing = [];

  if (!hasCommand("gs") && !hasCommand("gswin64c") && !hasCommand("gswin32c")) {
    missing.push("ghostscript");
  }

  if (!hasCommand("pdffonts")) {
    missing.push("xpdf");
  }

  return missing;
};

if (skipValue === "1" || skipValue === "true") {
  console.log("Skipping print tools setup because PUBLICATION_BUILDER_SKIP_PRINT_TOOLS is set.");
  process.exit(0);
}

const missing = missingTools();

if (missing.length === 0) {
  console.log("Print tools are ready: Ghostscript and pdffonts are installed.");
  process.exit(0);
}

if (process.platform === "darwin") {
  if (!hasCommand("brew")) {
    console.warn(`Missing print tools: ${missing.join(", ")}.`);
    console.warn("Homebrew was not found. Install Homebrew, then run: brew install ghostscript xpdf");
    process.exit(0);
  }

  console.log(`Installing missing print tools with Homebrew: ${missing.join(", ")}`);
  run("brew", ["install", ...missing]);
  process.exit(0);
}

if (isWindows) {
  if (hasCommand("winget")) {
    const packageIds = [];

    if (missing.includes("ghostscript")) {
      packageIds.push("ArtifexSoftware.GhostScript");
    }

    if (missing.includes("xpdf")) {
      packageIds.push("oschwartz10612.Poppler");
    }

    console.log(`Installing missing print tools with winget: ${missing.join(", ")}`);
    installWithWinget(packageIds);
    process.exit(0);
  }

  if (hasCommand("choco")) {
    const packages = [];

    if (missing.includes("ghostscript")) {
      packages.push("ghostscript");
    }

    if (missing.includes("xpdf")) {
      packages.push("poppler");
    }

    console.log(`Installing missing print tools with Chocolatey: ${missing.join(", ")}`);
    installWithChocolatey(packages);
    process.exit(0);
  }

  if (hasCommand("scoop")) {
    const packages = [];

    if (missing.includes("ghostscript")) {
      packages.push("ghostscript");
    }

    if (missing.includes("xpdf")) {
      packages.push("poppler");
    }

    console.log(`Installing missing print tools with Scoop: ${missing.join(", ")}`);
    installWithScoop(packages);
    process.exit(0);
  }

  console.warn(`Missing print tools: ${missing.join(", ")}.`);
  console.warn("Install one of winget, Chocolatey or Scoop, then run npm run setup:print again.");
  console.warn("Manual winget commands:");
  console.warn("  winget install --id ArtifexSoftware.GhostScript --exact --source winget");
  console.warn("  winget install --id oschwartz10612.Poppler --exact --source winget");
  process.exit(0);
}

console.warn(`Missing print tools: ${missing.join(", ")}.`);
console.warn("Install Ghostscript and xpdf/poppler for press-ready print builds.");
