// npm run release
// Validates the package, bumps its version, commits, and pushes the
// `v<version>` tag. publish.yml publishes to npm from the tag.
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";

const SEMVER =
  /^\d+\.\d+\.\d+(?:-(?:[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*))?(?:\+[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*)?$/;

function run(command) {
  execSync(command, { stdio: "inherit" });
}

function capture(command) {
  return execSync(command, { encoding: "utf8" }).trim();
}

function fail(message) {
  console.error(`\n${message}`);
  process.exit(1);
}

function gitTagExists(tag) {
  return (
    capture(`git tag --list ${tag}`) !== "" ||
    capture(`git ls-remote --tags origin ${tag}`) !== ""
  );
}

// Reads answers one line at a time, so piped input works too. End of input
// answers "".
const rl = createInterface({ input });
const lines = rl[Symbol.asyncIterator]();
async function ask(question) {
  output.write(question);
  const { value, done } = await lines.next();
  return done ? "" : value.trim();
}

function checkInSync() {
  const status = capture("git status --porcelain");
  if (status) {
    fail(
      `Working tree must be clean. Commit or stash changes first:\n${status}`
    );
  }

  const branch = capture("git rev-parse --abbrev-ref HEAD");
  let upstream;
  try {
    upstream = capture("git rev-parse --abbrev-ref @{u}");
  } catch {
    fail(`${branch} has no upstream; push it first.`);
  }
  run("git fetch --quiet origin");
  const unpushed = capture(`git log --oneline ${upstream}..HEAD`);
  if (unpushed) {
    fail(`Commits not pushed to ${upstream}:\n${unpushed}`);
  }
  if (capture(`git rev-list --count HEAD..${upstream}`) !== "0") {
    fail(`${branch} is behind ${upstream}; pull first.`);
  }
}

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const current = pkg.version;

checkInSync();

const version = await ask(`Current version: ${current}\nNew version: `);

if (!version) {
  fail("No version entered.");
}
if (!SEMVER.test(version)) {
  fail(
    `Invalid version "${version}". Use semver, e.g. 1.0.0 or 1.0.0-alpha.1.`
  );
}
if (version === current) {
  fail("New version must differ from the current version.");
}

const tag = `v${version}`;
if (gitTagExists(tag)) {
  fail(`Git tag ${tag} already exists.`);
}

const npmTag = version.includes("-") ? "next" : "latest";
const confirm = await ask(
  `Publish ${pkg.name}@${version} to @${npmTag}? [y/N] `
);
rl.close();
if (confirm.toLowerCase() !== "y") {
  fail("Cancelled.");
}

console.log("\nRunning validate…\n");
run("npm run validate");

run(`npm version ${version} --no-git-tag-version`);
run("git add package.json package-lock.json");
run(`git commit -m "${tag}"`);
run(`git tag ${tag}`);
run("git push origin HEAD");
run(`git push origin ${tag}`);

console.log(`
Done. CI will publish to npm (@${npmTag}) and create a GitHub release.
Install: npm install ${pkg.name}@${version}
`);
