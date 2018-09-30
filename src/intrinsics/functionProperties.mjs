import { Value } from '../value.mjs';
import {
  ToNumber,
  CreateBuiltinFunction,
  SetFunctionName,
  SetFunctionLength,
} from '../abstract-ops/all.mjs';
import { Q } from '../completion.mjs';

function isNaN([number]) {
  const num = Q(ToNumber(number));
  if (num.isNaN()) {
    return new Value(true);
  }
  return new Value(false);
}

export function CreateFunctionProperties(realmRec) {
  [
    ['isNaN', isNaN, 1],
  ].forEach(([name, fn, len]) => {
    fn = CreateBuiltinFunction(fn, [], realmRec);
    SetFunctionName(fn, new Value(name));
    SetFunctionLength(fn, new Value(len));
    realmRec.Intrinsics[`%${name}%`] = fn;
  });
}