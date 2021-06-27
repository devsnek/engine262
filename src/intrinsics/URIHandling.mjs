import { surroundingAgent } from '../engine.mjs';
import { Value } from '../value.mjs';
import {
  Assert,
  CreateBuiltinFunction,
  ToString,
} from '../abstract-ops/all.mjs';
import { CodePointAt } from '../static-semantics/all.mjs';
import { isHexDigit } from '../parser/Lexer.mjs';
import { Q, X } from '../completion.mjs';

function utf8Encode(utf) {
  if (utf <= 0x7F) {
    return [utf];
  }
  if (utf <= 0x07FF) {
    return [
      (((utf >> 6) & 0x1F) | 0xC0),
      (((utf >> 0) & 0x3F) | 0x80),
    ];
  }
  if (utf <= 0xFFFF) {
    return [
      (((utf >> 12) & 0x0F) | 0xE0),
      (((utf >> 6) & 0x3F) | 0x80),
      (((utf >> 0) & 0x3F) | 0x80),
    ];
  }
  if (utf <= 0x10FFFF) {
    return [
      (((utf >> 18) & 0x07) | 0xF0),
      (((utf >> 12) & 0x3F) | 0x80),
      (((utf >> 6) & 0x3F) | 0x80),
      (((utf >> 0) & 0x3F) | 0x80),
    ];
  }
  return null;
}

function utf8Decode(octets) {
  const b0 = octets[0];
  if (b0 <= 0x7F) {
    return b0;
  }
  if (b0 < 0xC2 || b0 > 0xF4) {
    return null;
  }
  const b1 = octets[1];

  switch (b0) {
    case 0xE0:
      if (b1 < 0xA0 || b1 > 0xBF) {
        return null;
      }
      break;
    case 0xED:
      if (b1 < 0x80 || b1 > 0x9F) {
        return null;
      }
      break;
    case 0xF0:
      if (b1 < 0x90 || b1 > 0xBF) {
        return null;
      }
      break;
    case 0xF4:
      if (b1 < 0x80 || b1 > 0x8F) {
        return null;
      }
      break;
    default:
      if (b1 < 0x80 || b1 > 0xBF) {
        return null;
      }
      break;
  }

  if (b0 <= 0xDF) {
    return ((b0 & 0x1F) << 6)
           | (b0 & 0x3F);
  }

  const b2 = octets[2];
  if (b2 < 0x80 || b2 > 0xBF) {
    return null;
  }
  if (b0 <= 0xEF) {
    return ((b0 & 0x0F) << 12)
           | ((b1 & 0x3F) << 6)
           | (b2 & 0x3F);
  }

  const b3 = octets[3];
  if (b3 < 0x80 || b3 > 0xBF) {
    return null;
  }

  return ((b0 & 0x07) << 18)
         | ((b1 & 0x3F) << 12)
         | ((b2 & 0x3F) << 6)
         | (b3 & 0x3F);
}

const uriReserved = ';/?:@&=+$,';
const uriAlpha = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const uriMark = '-_.!~*\'()';
const DecimalDigit = '0123456789';
const uriUnescaped = uriAlpha + DecimalDigit + uriMark;

// #sec-encode
function Encode(string, unescapedSet) {
  string = string.stringValue();
  // 1. Let strLen be the number of code units in string.
  const strLen = string.length;
  // 2. Let R be the empty String.
  let R = '';
  // 3. Let k be 0.
  let k = 0;
  // 4. Repeat,
  while (true) {
    // a. If k equals strLen, return R.
    if (k === strLen) {
      return new Value(R);
    }
    // b. Let C be the code unit at index k within string.
    const C = string[k];
    // c. If C is in unescapedSet, then
    if (unescapedSet.includes(C)) {
      // i. Set k to k + 1.
      k += 1;
      // ii. Set R to the string-concatenation of the previous value of R and C.
      R = `${R}${C}`;
    } else { // d. Else,
      // i. Let cp be ! CodePointAt(string, k).
      const cp = X(CodePointAt(string, k));
      // ii. If cp.[[IsUnpairedSurrogate]] is true, throw a URIError exception.
      if (cp.IsUnpairedSurrogate) {
        return surroundingAgent.Throw('URIError', 'URIMalformed');
      }
      // iii. Set k to k + cp.[[CodeUnitCount]].
      k += cp.CodeUnitCount;
      // iv. Let Octets be the List of octets resulting by applying the UTF-8 transformation to cp.[[CodePoint]].
      const Octets = utf8Encode(cp.CodePoint);
      // v. For each element octet of Octets in List order, do
      Octets.forEach((octet) => {
        // 1. Set R to the string-concatenation of:
        //   * the previous value of R
        //   * "%"
        //   * the String representation of octet, formatted as a two-digit uppercase hexadecimal number, padded to the left with a zero if necessary
        R = `${R}%${octet.toString(16).toUpperCase().padStart(2, '0')}`;
      });
    }
  }
}

// #sec-decode
function Decode(string, reservedSet) {
  string = string.stringValue();
  // 1. Let strLen be the number of code units in string.
  const strLen = string.length;
  // 2. Let R be the empty String.
  let R = '';
  // 3. Let k be 0.
  let k = 0;
  // 4. Repeat,
  while (true) {
    // a. If k equals strLen, return R.
    if (k === strLen) {
      return new Value(R);
    }
    // b. Let C be the code unit at index k within string.
    const C = string[k];
    let S;
    // c. If C is not the code unit 0x0025 (PERCENT SIGN), then
    if (C !== '\u{0025}') {
      S = C;
    } else { // d. Else,
      // i. Let start be k.
      const start = k;
      // ii. If k + 2 is greater than or equal to strLen, throw a URIError exception.
      if (k + 2 >= strLen) {
        return surroundingAgent.Throw('URIError', 'URIMalformed');
      }
      // iii. If the code units at index (k + 1) and (k + 2) within string do not represent hexadecimal digits, throw a URIError exception.
      if (!isHexDigit(string[k + 1]) || !isHexDigit(string[k + 2])) {
        return surroundingAgent.Throw('URIError', 'URIMalformed');
      }
      // iv. Let B be the 8-bit value represented by the two hexadecimal digits at index (k + 1) and (k + 2).
      const B = Number.parseInt(string.slice(k + 1, k + 3), 16);
      // v. Set k to k + 2.
      k += 2;
      // vi. If the most significant bit in B is 0, then
      if ((B & 0b10000000) === 0) {
        // 1. Let C be the code unit whose value is B.
        const innerC = String.fromCharCode(B);
        // 2. If C is not in reservedSet, then
        if (!reservedSet.includes(C)) {
          // a. Let S be the String value containing only the code unit C.
          S = innerC;
        } else { // 3. Else,
          // a. Let S be the substring of string from index start to index k inclusive.
          S = string.slice(start, k + 1);
        }
      } else { // vii. Else,
        // 1. Assert: the most significant bit in B is 1.
        Assert(B & 0b10000000);
        // 2. Let n be the smallest nonnegative integer such that (B << n) & 0x80 is equal to 0.
        let n = 0;
        while (((B << n) & 0x80) !== 0) {
          n += 1;
          if (n > 4) {
            break;
          }
        }
        // 3. If n equals 1 or n is greater than 4, throw a URIError exception.
        if (n === 1 || n > 4) {
          return surroundingAgent.Throw('URIError', 'URIMalformed');
        }
        // 4. Let Octets be a List of 8-bit integers of size n.
        const Octets = [];
        // 5. Set Octets[0] to B.
        Octets[0] = B;
        // 6. If k + (3 × (n - 1)) is greater than or equal to strLen, throw a URIError exception.
        if (k + (3 * (n - 1)) >= strLen) {
          return surroundingAgent.Throw('URIError', 'URIMalformed');
        }
        // 7. Let j be 1.
        let j = 1;
        // 8. Repeat, while j < n,
        while (j < n) {
          // a. Set k to k + 1.
          k += 1;
          // b. If the code unit at index k within string is not the code unit 0x0025 (PERCENT SIGN), throw a URIError exception.
          if (string[k] !== '\u{0025}') {
            return surroundingAgent.Throw('URIError', 'URIMalformed');
          }
          // c. If the code units at index (k + 1) and (k + 2) within string do not represent hexadecimal digits, throw a URIError exception.
          if (!isHexDigit(string[k + 1]) || !isHexDigit(string[k + 2])) {
            return surroundingAgent.Throw('URIError', 'URIMalformed');
          }
          // d. Let B be the 8-bit value represented by the two hexadecimal digits at index (k + 1) and (k + 2).
          const innerB = Number.parseInt(string.slice(k + 1, k + 3), 16);
          // e. If the two most significant bits in B are not 10, throw a URIError exception.
          if (innerB >> 6 !== 0b10) {
            return surroundingAgent.Throw('URIError', 'URIMalformed');
          }
          // f. Set k to k + 2.
          k += 2;
          // g. Set Octets[j] to B.
          Octets[j] = innerB;
          // h. Set j to j + 1.
          j += 1;
        }
        // 9. If Octets does not contain a valid UTF-8 encoding of a Unicode code point, throw a URIError exception.
        // 10. Let V be the value obtained by applying the UTF-8 transformation to Octets, that is, from a List of octets into a 21-bit value.
        const V = utf8Decode(Octets);
        if (V === null) {
          return surroundingAgent.Throw('URIError', 'URIMalformed');
        }
        // 11. Let S be the String value whose code units are, in order, the elements in UTF16Encoding(V).
        S = String.fromCodePoint(V);
      }
    }
    // e. Set R to the string-concatenation of the previous value of R and S.
    R = `${R}${S}`;
    // f. Set k to k + 1.
    k += 1;
  }
}

// #sec-decodeuri-encodeduri
function decodeURI([encodedURI = Value.undefined]) {
  // 1. Let uriString be ? ToString(encodedURI).
  const uriString = Q(ToString(encodedURI));
  // 2. Let reservedURISet be a String containing one instance of each code unit valid in uriReserved plus "#".
  const reservedURISet = `${uriReserved}#`;
  // 3. Return ? Decode(uriString, reservedURISet).
  return Q(Decode(uriString, reservedURISet));
}

// #sec-decodeuricomponent-encodeduricomponent
function decodeURIComponent([encodedURIComponent = Value.undefined]) {
  // 1. Let componentString be ? ToString(encodedURIComponent).
  const componentString = Q(ToString(encodedURIComponent));
  // 2. Let reservedURIComponentSet be the empty String.
  const reservedURIComponentSet = '';
  // 3. Return ? Decode(componentString, reservedURIComponentSet).
  return Q(Decode(componentString, reservedURIComponentSet));
}

// #sec-encodeuri-uri
function encodeURI([uri = Value.undefined]) {
  // 1. Let uriString be ? ToString(uri).
  const uriString = Q(ToString(uri));
  // 2. Let unescapedURISet be a String containing one instance of each code unit valid in uriReserved and uriUnescaped plus "#".
  const unescapedURISet = `${uriReserved}${uriUnescaped}#`;
  // 3. Return ? Encode(uriString, unescapedURISet).
  return Q(Encode(uriString, unescapedURISet));
}

// #sec-encodeuricomponent-uricomponent
function encodeURIComponent([uriComponent = Value.undefined]) {
  // 1. Let componentString be ? ToString(uriComponent).
  const componentString = Q(ToString(uriComponent));
  // 2. Let unescapedURIComponentSet be a String containing one instance of each code unit valid in uriUnescaped.
  const unescapedURIComponentSet = uriUnescaped;
  // 3. Return ? Encode(componentString, unescapedURIComponentSet).
  return Q(Encode(componentString, unescapedURIComponentSet));
}

export function bootstrapURIHandling(realmRec) {
  [
    ['decodeURI', decodeURI, 1],
    ['decodeURIComponent', decodeURIComponent, 1],
    ['encodeURI', encodeURI, 1],
    ['encodeURIComponent', encodeURIComponent, 1],
  ].forEach(([name, f, length]) => {
    realmRec.Intrinsics[`%${name}%`] = CreateBuiltinFunction(f, length, new Value(name), [], realmRec);
  });
}
