import {
  COMMUTE_REFERENCES,
  estimateCommutes,
  estimateCommuteFrom,
} from "../src/lib/commute";

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
}

assert(COMMUTE_REFERENCES.length === 2, "two commute references");
assert(
  COMMUTE_REFERENCES.some((r) => r.label.includes("东升科技园")),
  "family reference exists"
);

const estimates = estimateCommutes("北京市朝阳区天元港中心");
assert(estimates.length === 2, "returns both references");
assert(estimates[0].homeShortLabel === "家", "home label");
assert(estimates[1].homeShortLabel === "家人", "family label");
assert(estimates[0].subwayMinutes > 0, "home commute minutes");
assert(estimates[1].subwayMinutes > 0, "family commute minutes");

const nearFamily = estimateCommuteFrom(
  COMMUTE_REFERENCES[1],
  "北京海淀区东升科技园"
);
assert(nearFamily != null && nearFamily.distanceKm < 3, "near family park");

console.log("OK: commute references verified");
