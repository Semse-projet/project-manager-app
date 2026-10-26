#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inventoryRepository } from "./library-hub-inventory-lib.mjs";

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let root = defaultRoot;
const args=process.argv.slice(2);
if(args.length>0){
  if(args.length!==2 || args[0]!=="--root" || !args[1]) {
    process.stderr.write("Usage: node scripts/library-hub-inventory.mjs [--root /absolute/checkout]\n");
    process.exit(2);
  }
  root=path.resolve(args[1]);
}
try{
  const output=inventoryRepository(root);
  process.stdout.write(JSON.stringify(output,null,2)+"\n");
}catch(e){
  process.stderr.write("SEMSE Library Hub: inventory failed ("+(e?.message||"unknown error")+")\n");
  process.exitCode=1;
}
