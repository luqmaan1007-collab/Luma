#!/usr/bin/env node
// ===============================
// Luma CLI / Compiler v1.0
// ===============================

const fs = require("fs");
const path = require("path");
const babel = require("@babel/core");
const chokidar = require("chokidar");
const yargs = require("yargs");

// -------------------------------
// Compile function
// -------------------------------
function compileLumaFile(inputFile, outputFile) {
  const code = fs.readFileSync(inputFile, "utf-8");
  const result = babel.transformSync(code, {
    presets: ["@babel/preset-react"],
    plugins: ["@babel/plugin-transform-react-jsx"],
    filename: inputFile,
    sourceMaps: true,
  });
  fs.writeFileSync(outputFile, result.code);
  console.log(`[Luma] Compiled ${inputFile} -> ${outputFile}`);
}

// -------------------------------
// CLI Setup
// -------------------------------
const argv = yargs
  .command("build <file>", "Compile a .luma file to JS", yargs => {
    yargs.positional("file", { describe: "Input .luma file", type: "string" });
  })
  .option("out", { alias: "o", type: "string", describe: "Output JS file" })
  .option("watch", { alias: "w", type: "boolean", describe: "Watch for changes" })
  .demandCommand(1, "You must specify a command")
  .help().argv;

const inputPath = path.resolve(argv.file);
const outputPath = path.resolve(argv.out || inputPath.replace(/\.luma$/, ".js"));

// Initial build
compileLumaFile(inputPath, outputPath);

// Watch mode
if (argv.watch) {
  chokidar.watch(inputPath).on("change", () => {
    console.log(`[Luma] Detected change in ${inputPath}`);
    compileLumaFile(inputPath, outputPath);
  });
}
