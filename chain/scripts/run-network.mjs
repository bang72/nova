#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const args=process.argv.slice(2),index=args.indexOf("--dir"),networkDir=resolve(index>=0?args[index+1]:".nova-network"),manifest=JSON.parse(readFileSync(join(networkDir,"network.json"),"utf8")),entry=fileURLToPath(new URL("../src/consensus-node.mjs",import.meta.url));
const children=manifest.validators.map((validator,nodeIndex)=>{const child=spawn(process.execPath,[entry],{env:{...process.env,NOVA_DATA_DIR:join(networkDir,validator.nodeDir)},stdio:["ignore","pipe","pipe"]});child.stdout.on("data",chunk=>process.stdout.write(`[node-${nodeIndex+1}] ${chunk}`));child.stderr.on("data",chunk=>process.stderr.write(`[node-${nodeIndex+1}] ${chunk}`));return child});
const shutdown=()=>{for(const child of children)child.kill("SIGTERM")};process.on("SIGINT",shutdown);process.on("SIGTERM",shutdown);
await new Promise((resolveExit,reject)=>{let stopped=0;for(const child of children)child.on("exit",code=>{stopped+=1;if(code&&code!==0)reject(new Error(`validator exited with code ${code}`));else if(stopped===children.length)resolveExit()})});
