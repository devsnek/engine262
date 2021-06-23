import {
  Assert,
  CreateBuiltinFunction,
  ToInt32,
  ToString,
  F,
} from '../abstract-ops/all.mjs';
import { TrimString } from '../runtime-semantics/all.mjs';
import { Q, X } from '../completion.mjs';
import { Value } from '../value.mjs';

function digitToNumber(digit) {
  digit = digit.charCodeAt(0);
  if (digit < 0x30 /* 0 */) {
    return NaN;
  }
  if (digit <= 0x39 /* 9 */) {
    return digit - 0x30;
  }
  // Convert to lower case.
  digit &= ~0x20; // eslint-disable-line no-bitwise
  if (digit < 0x41 /* A */) {
    return NaN;
  }
  if (digit <= 0x5a /* Z */) {
    return digit - 0x41 /* A */ + 10;
  }
  return NaN;
}

function stringToRadixNumber(str, R) {
  let num = 0;
  for (let i = 0; i < str.length; i += 1) {
    const power = str.length - i - 1;
    const multiplier = R ** power;
    const dig = digitToNumber(str[i]);
    Assert(!Number.isNaN(dig) && dig < R);
    num += dig * multiplier;
  }
  return num;
}

function searchNotRadixDigit(str, R) {
  for (let i = 0; i < str.length; i += 1) {
    const num = digitToNumber(str[i]);
    if (Number.isNaN(num) || num >= R) {
      return i;
    }
  }
  return str.length;
}

// #sec-parseint-string-radix
function ParseInt([string = Value.undefined, radix = Value.undefined]) {
  const inputString = Q(ToString(string));
  let S = X(TrimString(inputString, 'start')).stringValue();
  let sign = 1;
  if (S !== '' && S[0] === '\x2D') {
    sign = -1;
  }
  if (S !== '' && (S[0] === '\x2B' || S[0] === '\x2D')) {
    S = S.slice(1);
  }

  let R = Q(ToInt32(radix)).numberValue();
  let stripPrefix = true;
  if (R !== 0) {
    if (R < 2 || R > 36) {
      return F(NaN);
    }
    if (R !== 16) {
      stripPrefix = false;
    }
  } else {
    R = 10;
  }
  if (stripPrefix === true) {
    if (S.length >= 2 && (S.startsWith('0x') || S.startsWith('0X'))) {
      S = S.slice(2);
      R = 16;
    }
  }
  const Z = S.slice(0, searchNotRadixDigit(S, R));
  if (Z === '') {
    return F(NaN);
  }
  const mathInt = stringToRadixNumber(Z, R);
  if (mathInt === 0) {
    if (sign === -1) {
      return F(-0);
    }
    return F(+0);
  }
  const number = mathInt;
  return F(sign * number);
}

export function bootstrapParseInt(realmRec) {
  realmRec.Intrinsics['%parseInt%'] = CreateBuiltinFunction(ParseInt, 2, new Value('parseInt'), [], realmRec);
}
