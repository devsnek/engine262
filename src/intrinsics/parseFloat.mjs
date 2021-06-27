import {
  CreateBuiltinFunction,
  ToString,
  F,
} from '../abstract-ops/all.mjs';
import { Q, X } from '../completion.mjs';
import { Value } from '../value.mjs';
import {
  TrimString,
} from '../runtime-semantics/all.mjs';

// #sec-parsefloat-string
function ParseFloat([string = Value.undefined]) {
  // 1. Let inputString be ? ToString(string).
  const inputString = Q(ToString(string));
  // 2. Let trimmedString be ! TrimString(inputString, start).
  const trimmedString = X(TrimString(inputString, 'start')).stringValue();
  // 3. If neither trimmedString nor any prefix of trimmedString satisfies the syntax of a StrDecimalLiteral (see 7.1.4.1), return NaN.
  // 4. Let numberString be the longest prefix of trimmedString, which might be trimmedString itself, that satisfies the syntax of a StrDecimalLiteral.
  // 5. Let mathFloat be MV of numberString.
  // 6. If mathFloat = 0ℝ, then
  //   a. If the first code unit of trimmedString is the code unit 0x002D (HYPHEN-MINUS), return -0.
  //   b. Return +0.
  // 7. Return the Number value for mathFloat.
  let numberString = trimmedString;
  if (/^[+-]/.test(numberString)) {
    numberString = numberString.slice(1);
  }
  const multiplier = trimmedString.startsWith('-') ? -1 : 1;
  if (numberString.startsWith('Infinity')) {
    return F(Infinity * multiplier);
  }
  let index = 0;
  done: { // eslint-disable-line no-labels
    // Eat leading zeros
    while (numberString[index] === '0') {
      index += 1;
      if (index === numberString.length) {
        return F(+0 * multiplier);
      }
    }
    // Eat integer part
    if (numberString[index] !== '.') {
      while (/[0-9]/.test(numberString[index])) {
        index += 1;
      }
    }
    // Eat fractional part
    if (numberString[index] === '.') {
      if (!/[0-9eE]/.test(numberString[index + 1])) {
        break done; // eslint-disable-line no-labels
      }
      index += 1;
      while (/[0-9]/.test(numberString[index])) {
        index += 1;
      }
    }
    // Eat exponent part
    if (numberString[index] === 'e' || numberString[index] === 'E') {
      if (!/[-+0-9]/.test(numberString[index + 1])) {
        break done; // eslint-disable-line no-labels
      }
      index += 1;
      if (numberString[index] === '-' || numberString[index] === '+') {
        index += 1;
      }
      while (/[0-9]/.test(numberString[index])) {
        index += 1;
      }
    }
  }
  return F(parseFloat(numberString.slice(0, index)) * multiplier);
}

export function bootstrapParseFloat(realmRec) {
  realmRec.Intrinsics['%parseFloat%'] = CreateBuiltinFunction(ParseFloat, 1, new Value('parseFloat'), [], realmRec);
}
