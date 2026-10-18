#!/usr/bin/env node
/**
 * T-008: read-only multipart staging quiescence precheck.
 *
 * Deliberately refuses to attest a backup. An empty candidate must also be
 * backed by durable writer fencing, a consistent Evidence/PG checkpoint, and
 * an independently verified offsite restore.
 *
 * No file bytes, manifest JSON, private storage keys or session IDs are read
 * or printed. Symlinks, missing directories, unknown files and unmounted
 * roots fail closed.
 */
import { lstat, readdir, realpath, readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const MANIFEST = /^mus_[0-9a-f-]{36}\.json$/;
const SESSION_DIR = /^mus_[0-9a-f-]{36}$/;
const PART_FILE = /^part-[1-9][0-9]*\.bin$/;
const MAX_ENTRIES = 10000;

function posixChildOf(candidate, parent) {
  return typeof candidate === "string" && typeof parent === "string" &&
    candidate.startsWith(parent + "/") &&
    path.posix.isAbsolute(candidate) &&
    path.posix.normalize(candidate) === candidate &&
    !candidate.includes("\\") &&
    !candidate.includes("\0");
}
function mountedData(mountInfo) {
  return mountInfo.split("\n").some(line => {
    const fields = line.split(" ");
    return fields.length > 5 && fields[4] === "/data";
  });
}
async function ordinaryDirectory(root) {
  const s = await lstat(root);
  if (!s.isDirectory() || s.isSymbolicLink()) throw Error("unsafe_multipart_directory");
  return realpath(root);
}
async function safeChildren(root) {
  const entries = await readdir(root, { withFileTypes:true });
  if (entries.length > MAX_ENTRIES) throw Error("multipart_entry_limit");
  return entries;
}

/**
 * enforceProductionLayout=false is strictly a synthetic unit-test fixture.
 * Not an environment variable or CLI flag: real CLI always enforces /data.
 */
export async function inspectMultipartQuiescence({
  storageRoot,
  multipartRoot,
  mountInfo = "",
  enforceProductionLayout = true,
} = {}) {
  const base = {
    schema:"semse-multipart-quiescence-precheck-v1",
    readOnly:true,
    backupVerified:false,
    evidenceDatabaseReconciled:false,
    writerCoverageAttested:false,
    result:"BLOCKED",
    reason:"unverified_multipart_staging",
  };
  try {
    if (!storageRoot || !multipartRoot ||
        !path.posix.isAbsolute(storageRoot) || !path.posix.isAbsolute(multipartRoot) ||
        path.posix.normalize(storageRoot)!==storageRoot ||
        path.posix.normalize(multipartRoot)!==multipartRoot ||
        !posixChildOf(multipartRoot,storageRoot)) {
      return {...base, reason:"multipart_outside_originals_root"};
    }
    if (enforceProductionLayout &&
        (!posixChildOf(storageRoot,"/data") || !mountedData(mountInfo))) {
      return {...base, reason:"persistent_mount_not_verified"};
    }
    const realStorage = await ordinaryDirectory(storageRoot);
    const realMultipart = await ordinaryDirectory(multipartRoot);
    if (!posixChildOf(realMultipart,realStorage)) {
      return {...base,reason:"multipart_realpath_escaped"};
    }

    let manifests=0,partDirectories=0,partFiles=0,unknown=0;
    const entries=await safeChildren(realMultipart);
    for(const entry of entries) {
      if (entry.isSymbolicLink()) throw Error("multipart_symlink");
      if (entry.name === "parts" && entry.isDirectory()) {
        const partRoot = path.join(realMultipart,"parts");
        if (await ordinaryDirectory(partRoot) !== partRoot)
          throw Error("multipart_parts_realpath");
        const sessions=await safeChildren(partRoot);
        for(const session of sessions) {
          if (session.isSymbolicLink()) throw Error("multipart_session_symlink");
          if (!session.isDirectory() || !SESSION_DIR.test(session.name)) {
            unknown++;continue;
          }
          partDirectories++;
          const sessionRoot=path.join(partRoot,session.name);
          if (await ordinaryDirectory(sessionRoot) !== sessionRoot)
            throw Error("multipart_session_realpath");
          const files=await safeChildren(sessionRoot);
          for(const file of files) {
            if(file.isSymbolicLink()) throw Error("multipart_part_symlink");
            if(file.isFile() && PART_FILE.test(file.name)) partFiles++;
            else unknown++;
            if(manifests+partDirectories+partFiles+unknown > MAX_ENTRIES)
              throw Error("multipart_entry_limit");
          }
        }
      } else if(entry.isFile() && MANIFEST.test(entry.name)) {
        manifests++;
      } else {
        unknown++;
      }
      if(manifests+partDirectories+partFiles+unknown > MAX_ENTRIES)
        throw Error("multipart_entry_limit");
    }
    const counts={manifests,partDirectories,partFiles,unrecognizedEntries:unknown};
    // Do not claim global freeze; this is an isolated FS listing taken at
    // one point in time, with no PostgreSQL lease/lock or Evidence snapshot.
    if (manifests+partDirectories+partFiles+unknown !== 0) {
      return {...base,reason:"multipart_pending_or_unrecognized",counts};
    }
    return {...base,result:"EMPTY_CANDIDATE",reason:"no_multipart_entries_observed",
      counts,
      qualification:"Filesystem-only, not a snapshot. Gate FROZEN, writer census and Evidence checkpoint still required."};
  } catch {
    // Never leak secrets, session names, paths or manifest content in output.
    return {...base,reason:"multipart_unreadable_or_unsafe"};
  }
}
const direct = process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
// Railway operator streams this source via audited SSH stdin, as with the
// existing originals inventory. An import in tests must never self-execute.
const inline = import.meta.url.includes("/[eval");
if(direct || inline) {
  try {
    const env=process.env;
    const mountInfo=await readFile("/proc/self/mountinfo","utf8").catch(()=>"");
    const result=await inspectMultipartQuiescence({
      storageRoot:env.SEMSE_STORAGE_ROOT,
      multipartRoot:env.SEMSE_MULTIPART_STORAGE_ROOT,
      mountInfo,
    });
    process.stdout.write(JSON.stringify(result)+"\n");
    // EMPTY_CANDIDATE is intentionally only a precondition, NOT an attested
    // backup acceptance. Exit zero permits chaining independent hard gates.
    if (result.result !== "EMPTY_CANDIDATE") process.exitCode=2;
  } catch {
    process.stderr.write("Multipart precheck failed closed.\n");
    process.exitCode=1;
  }
}
