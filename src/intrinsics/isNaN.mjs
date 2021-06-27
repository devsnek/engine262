import {
  ToNumber,
  CreateBuiltinFunction,
} from '../abstract-ops/all.mjs';
import { Value } from '../value.mjs';
import { Q } from '../completion.mjs';

// #sec-isnan-number
function IsNaN([number = Value.undefined]) {
  // 1. Let num be ? ToNumber(number).
  const num = Q(ToNumber(number));
  // 2. If num is NaN, return true.
  if (num.isNaN()) {
    return Value.true;
  }
  // 3. Otherwise, return false.
  return Value.false;
}

export function bootstrapIsNaN(realmRec) {
  realmRec.Intrinsics['%isNaN%'] = CreateBuiltinFunction(IsNaN, 1, new Value('isNaN'), [], realmRec);
}
