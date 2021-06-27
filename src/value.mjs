import { surroundingAgent } from './engine.mjs';
import {
  Assert,
  CreateBuiltinFunction,
  OrdinaryDefineOwnProperty,
  OrdinaryDelete,
  OrdinaryGet,
  OrdinaryGetOwnProperty,
  OrdinaryGetPrototypeOf,
  OrdinaryHasProperty,
  OrdinaryIsExtensible,
  OrdinaryOwnPropertyKeys,
  OrdinaryPreventExtensions,
  OrdinarySet,
  OrdinarySetPrototypeOf,
  ToInt32,
  ToUint32,
  Z,
  F,
} from './abstract-ops/all.mjs';
import { EnvironmentRecord } from './environment.mjs';
import { Completion, X } from './completion.mjs';
import { ValueMap, OutOfRange } from './helpers.mjs';

// #sec-ecmascript-language-types
export class Value {
  constructor(value = undefined, length = undefined, name = undefined, prefix = undefined) {
    if (new.target !== Value) {
      return this;
    }

    switch (typeof value) {
      case 'string':
        return new StringValue(value);
      case 'number':
        return new NumberValue(value);
      case 'bigint':
        return new BigIntValue(value);
      case 'function':
        return CreateBuiltinFunction(
          value, length === undefined ? 0 : length,
          name === undefined ? new Value('') : name,
          [], undefined, undefined, prefix,
        );
      default:
        throw new OutOfRange('new Value', value);
    }
  }
}

export class PrimitiveValue extends Value {}

// #sec-ecmascript-language-types-undefined-type
export class UndefinedValue extends PrimitiveValue {}

// #sec-ecmascript-language-types-null-type
export class NullValue extends PrimitiveValue {}

// #sec-ecmascript-language-types-boolean-type
export class BooleanValue extends PrimitiveValue {
  constructor(v) {
    super();
    this.boolean = v;
  }

  booleanValue() {
    return this.boolean;
  }

  [Symbol.for('nodejs.util.inspect.custom')]() {
    return `Boolean { ${this.boolean} }`;
  }
}

Object.defineProperties(Value, {
  undefined: { value: new UndefinedValue(), configurable: false, writable: false },
  null: { value: new NullValue(), configurable: false, writable: false },
  true: { value: new BooleanValue(true), configurable: false, writable: false },
  false: { value: new BooleanValue(false), configurable: false, writable: false },
});

// #sec-ecmascript-language-types-string-type
class StringValue extends PrimitiveValue {
  constructor(string) {
    super();
    this.string = string;
  }

  stringValue() {
    return this.string;
  }
}
// rename for static semantics StringValue() conflict
export { StringValue as JSStringValue };

// #sec-ecmascript-language-types-symbol-type
export class SymbolValue extends PrimitiveValue {
  constructor(Description) {
    super();
    this.Description = Description;
  }
}

export const wellKnownSymbols = Object.create(null);
for (const name of [
  'asyncIterator',
  'hasInstance',
  'isConcatSpreadable',
  'iterator',
  'match',
  'matchAll',
  'replace',
  'search',
  'species',
  'split',
  'toPrimitive',
  'toStringTag',
  'unscopables',
]) {
  const sym = new SymbolValue(new StringValue(`Symbol.${name}`));
  wellKnownSymbols[name] = sym;
}
Object.freeze(wellKnownSymbols);

// #sec-ecmascript-language-types-number-type
export class NumberValue extends PrimitiveValue {
  constructor(number) {
    super();
    this.number = number;
  }

  numberValue() {
    return this.number;
  }

  isNaN() {
    return Number.isNaN(this.number);
  }

  isInfinity() {
    return !Number.isFinite(this.number) && !this.isNaN();
  }

  isFinite() {
    return Number.isFinite(this.number);
  }

  // #sec-numeric-types-number-unaryMinus
  static unaryMinus(x) {
    if (x.isNaN()) {
      return F(NaN);
    }
    return F(-x.numberValue());
  }

  // #sec-numeric-types-number-bitwiseNOT
  static bitwiseNOT(x) {
    // 1. Let oldValue be ! ToInt32(x).
    const oldValue = X(ToInt32(x));
    // 2. Return the result of applying bitwise complement to oldValue. The result is a signed 32-bit integer.
    return F(~oldValue.numberValue());
  }

  // #sec-numeric-types-number-exponentiate
  static exponentiate(base, exponent) {
    return F(base.numberValue() ** exponent.numberValue());
  }

  // #sec-numeric-types-number-multiply
  static multiply(x, y) {
    return F(x.numberValue() * y.numberValue());
  }

  // #sec-numeric-types-number-divide
  static divide(x, y) {
    return F(x.numberValue() / y.numberValue());
  }

  // #sec-numeric-types-number-remainder
  static remainder(n, d) {
    return F(n.numberValue() % d.numberValue());
  }

  // #sec-numeric-types-number-add
  static add(x, y) {
    return F(x.numberValue() + y.numberValue());
  }

  // #sec-numeric-types-number-subtract
  static subtract(x, y) {
    // The result of - operator is x + (-y).
    return NumberValue.add(x, F(-y.numberValue()));
  }

  // #sec-numeric-types-number-leftShift
  static leftShift(x, y) {
    // 1. Let lnum be ! ToInt32(x).
    const lnum = X(ToInt32(x));
    // 2. Let rnum be ! ToUint32(y).
    const rnum = X(ToUint32(y));
    // 3. Let shiftCount be the result of masking out all but the least significant 5 bits of rnum, that is, compute rnum & 0x1F.
    const shiftCount = rnum.numberValue() & 0x1F; // eslint-disable-line no-bitwise
    // 4. Return the result of left shifting lnum by shiftCount bits. The result is a signed 32-bit integer.
    return F(lnum.numberValue() << shiftCount); // eslint-disable-line no-bitwise
  }

  // #sec-numeric-types-number-signedRightShift
  static signedRightShift(x, y) {
    // 1. Let lnum be ! ToInt32(x).
    const lnum = X(ToInt32(x));
    // 2. Let rnum be ! ToUint32(y).
    const rnum = X(ToUint32(y));
    // 3. Let shiftCount be the result of masking out all but the least significant 5 bits of rnum, that is, compute rnum & 0x1F.
    const shiftCount = rnum.numberValue() & 0x1F; // eslint-disable-line no-bitwise
    // 4. Return the result of performing a sign-extending right shift of lnum by shiftCount bits.
    //    The most significant bit is propagated. The result is a signed 32-bit integer.
    return F(lnum.numberValue() >> shiftCount); // eslint-disable-line no-bitwise
  }

  // #sec-numeric-types-number-unsignedRightShift
  static unsignedRightShift(x, y) {
    // 1. Let lnum be ! ToInt32(x).
    const lnum = X(ToInt32(x));
    // 2. Let rnum be ! ToUint32(y).
    const rnum = X(ToUint32(y));
    // 3. Let shiftCount be the result of masking out all but the least significant 5 bits of rnum, that is, compute rnum & 0x1F.
    const shiftCount = rnum.numberValue() & 0x1F; // eslint-disable-line no-bitwise
    // 4. Return the result of performing a zero-filling right shift of lnum by shiftCount bits.
    //    Vacated bits are filled with zero. The result is an unsigned 32-bit integer.
    return F(lnum.numberValue() >>> shiftCount); // eslint-disable-line no-bitwise
  }

  // #sec-numeric-types-number-lessThan
  static lessThan(x, y) {
    if (x.isNaN()) {
      return Value.undefined;
    }
    if (y.isNaN()) {
      return Value.undefined;
    }
    // If nx and ny are the same Number value, return false.
    // If nx is +0 and ny is -0, return false.
    // If nx is -0 and ny is +0, return false.
    if (x.numberValue() === y.numberValue()) {
      return Value.false;
    }
    if (x.numberValue() === +Infinity) {
      return Value.false;
    }
    if (y.numberValue() === +Infinity) {
      return Value.true;
    }
    if (y.numberValue() === -Infinity) {
      return Value.false;
    }
    if (x.numberValue() === -Infinity) {
      return Value.true;
    }
    return x.numberValue() < y.numberValue() ? Value.true : Value.false;
  }

  // #sec-numeric-types-number-equal
  static equal(x, y) {
    if (x.isNaN()) {
      return Value.false;
    }
    if (y.isNaN()) {
      return Value.false;
    }
    const xVal = x.numberValue();
    const yVal = y.numberValue();
    if (xVal === yVal) {
      return Value.true;
    }
    if (Object.is(xVal, 0) && Object.is(yVal, -0)) {
      return Value.true;
    }
    if (Object.is(xVal, -0) && Object.is(yVal, 0)) {
      return Value.true;
    }
    return Value.false;
  }

  // #sec-numeric-types-number-sameValue
  static sameValue(x, y) {
    if (x.isNaN() && y.isNaN()) {
      return Value.true;
    }
    const xVal = x.numberValue();
    const yVal = y.numberValue();
    if (Object.is(xVal, 0) && Object.is(yVal, -0)) {
      return Value.false;
    }
    if (Object.is(xVal, -0) && Object.is(yVal, 0)) {
      return Value.false;
    }
    if (xVal === yVal) {
      return Value.true;
    }
    return Value.false;
  }

  // #sec-numeric-types-number-sameValueZero
  static sameValueZero(x, y) {
    if (x.isNaN() && y.isNaN()) {
      return Value.true;
    }
    const xVal = x.numberValue();
    const yVal = y.numberValue();
    if (Object.is(xVal, 0) && Object.is(yVal, -0)) {
      return Value.true;
    }
    if (Object.is(xVal, -0) && Object.is(yVal, 0)) {
      return Value.true;
    }
    if (xVal === yVal) {
      return Value.true;
    }
    return Value.false;
  }

  // #sec-numeric-types-number-bitwiseAND
  static bitwiseAND(x, y) {
    // 1. Return NumberBitwiseOp(&, x, y).
    return NumberBitwiseOp('&', x, y);
  }

  // #sec-numeric-types-number-bitwiseXOR
  static bitwiseXOR(x, y) {
    // 1. Return NumberBitwiseOp(^, x, y).
    return NumberBitwiseOp('^', x, y);
  }

  // #sec-numeric-types-number-bitwiseOR
  static bitwiseOR(x, y) {
    // 1. Return NumberBitwiseOp(|, x, y).
    return NumberBitwiseOp('|', x, y);
  }

  // #sec-numeric-types-number-tostring
  static toString(x) {
    if (x.isNaN()) {
      return new Value('NaN');
    }
    const xVal = x.numberValue();
    if (xVal === 0) {
      return new Value('0');
    }
    if (xVal < 0) {
      const str = X(NumberValue.toString(F(-xVal))).stringValue();
      return new Value(`-${str}`);
    }
    if (x.isInfinity()) {
      return new Value('Infinity');
    }
    // TODO: implement properly
    return new Value(`${xVal}`);
  }
}

NumberValue.unit = new NumberValue(1);

// #sec-numberbitwiseop
function NumberBitwiseOp(op, x, y) {
  // 1. Let lnum be ! ToInt32(x).
  const lnum = X(ToInt32(x));
  // 2. Let rnum be ! ToUint32(y).
  const rnum = X(ToUint32(y));
  // 3. Return the result of applying the bitwise operator op to lnum and rnum. The result is a signed 32-bit integer.
  switch (op) {
    case '&':
      return F(lnum.numberValue() & rnum.numberValue());
    case '|':
      return F(lnum.numberValue() | rnum.numberValue());
    case '^':
      return F(lnum.numberValue() ^ rnum.numberValue());
    default:
      throw new OutOfRange('NumberBitwiseOp', op);
  }
}

// #sec-ecmascript-language-types-bigint-type
export class BigIntValue extends PrimitiveValue {
  constructor(bigint) {
    super();
    this.bigint = bigint;
  }

  bigintValue() {
    return this.bigint;
  }

  isNaN() {
    return false;
  }

  isFinite() {
    return true;
  }

  // #sec-numeric-types-bigint-unaryMinus
  static unaryMinus(x) {
    if (x.bigintValue() === 0n) {
      return Z(0n);
    }
    return Z(-x.bigintValue());
  }

  // #sec-numeric-types-bigint-bitwiseNOT
  static bitwiseNOT(x) {
    return Z(-x.bigintValue() - 1n);
  }

  // #sec-numeric-types-bigint-exponentiate
  static exponentiate(base, exponent) {
    // 1. If exponent < 0n, throw a RangeError exception.
    if (exponent.bigintValue() < 0n) {
      return surroundingAgent.Throw('RangeError', 'BigIntNegativeExponent');
    }
    // 2. If base is 0n and exponent is 0n, return 1n.
    if (base.bigintValue() === 0n && exponent.bigintValue() === 0n) {
      return Z(1n);
    }
    // 3. Return the BigInt value that represents the mathematical value of base raised to the power exponent.
    return Z(base.bigintValue() ** exponent.bigintValue());
  }

  // #sec-numeric-types-bigint-multiply
  static multiply(x, y) {
    return Z(x.bigintValue() * y.bigintValue());
  }

  // #sec-numeric-types-bigint-divide
  static divide(x, y) {
    // 1. If y is 0n, throw a RangeError exception.
    if (y.bigintValue() === 0n) {
      return surroundingAgent.Throw('RangeError', 'BigIntDivideByZero');
    }
    // 2. Let quotient be the mathematical value of x divided by y.
    const quotient = x.bigintValue() / y.bigintValue();
    // 3. Return the BigInt value that represents quotient rounded towards 0 to the next integral value.
    return Z(quotient);
  }

  // #sec-numeric-types-bigint-remainder
  static remainder(n, d) {
    // 1. If d is 0n, throw a RangeError exception.
    if (d.bigintValue() === 0n) {
      return surroundingAgent.Throw('RangeError', 'BigIntDivideByZero');
    }
    // 2. If n is 0n, return 0n.
    if (n.bigintValue() === 0n) {
      return Z(0n);
    }
    // 3. Let r be the BigInt defined by the mathematical relation r = n - (d × q)
    //   where q is a BigInt that is negative only if n/d is negative and positive
    //   only if n/d is positive, and whose magnitude is as large as possible without
    //   exceeding the magnitude of the true mathematical quotient of n and d.
    const r = Z(n.bigintValue() % d.bigintValue());
    // 4. Return r.
    return r;
  }

  // #sec-numeric-types-bigint-add
  static add(x, y) {
    return Z(x.bigintValue() + y.bigintValue());
  }

  // #sec-numeric-types-bigint-subtract
  static subtract(x, y) {
    return Z(x.bigintValue() - y.bigintValue());
  }

  // #sec-numeric-types-bigint-leftShift
  static leftShift(x, y) {
    return Z(x.bigintValue() << y.bigintValue()); // eslint-disable-line no-bitwise
  }

  // #sec-numeric-types-bigint-signedRightShift
  static signedRightShift(x, y) {
    // 1. Return BigInt::leftShift(x, -y).
    return BigIntValue.leftShift(x, Z(-y.bigintValue()));
  }

  // #sec-numeric-types-bigint-unsignedRightShift
  static unsignedRightShift(_x, _y) {
    return surroundingAgent.Throw('TypeError', 'BigIntUnsignedRightShift');
  }

  // #sec-numeric-types-bigint-lessThan
  static lessThan(x, y) {
    return x.bigintValue() < y.bigintValue() ? Value.true : Value.false;
  }

  // #sec-numeric-types-bigint-equal
  static equal(x, y) {
    // Return true if x and y have the same mathematical integer value and false otherwise.
    return x.bigintValue() === y.bigintValue() ? Value.true : Value.false;
  }

  // #sec-numeric-types-bigint-sameValue
  static sameValue(x, y) {
    // 1. Return BigInt::equal(x, y).
    return BigIntValue.equal(x, y);
  }

  // #sec-numeric-types-bigint-sameValueZero
  static sameValueZero(x, y) {
    // 1. Return BigInt::equal(x, y).
    return BigIntValue.equal(x, y);
  }

  // #sec-numeric-types-bigint-bitwiseAND
  static bitwiseAND(x, y) {
    // 1. Return BigIntBitwiseOp(&, x, y).
    return BigIntBitwiseOp('&', x, y);
  }

  // #sec-numeric-types-bigint-bitwiseXOR
  static bitwiseXOR(x, y) {
    // 1. Return BigIntBitwiseOp(^, x, y).
    return BigIntBitwiseOp('^', x, y);
  }

  // #sec-numeric-types-bigint-bitwiseOR
  static bitwiseOR(x, y) {
    // 1. Return BigIntBitwiseOp(|, x, y);
    return BigIntBitwiseOp('|', x, y);
  }

  // #sec-numeric-types-bigint-tostring
  static toString(x) {
    // 1. If x is less than zero, return the string-concatenation of the String "-" and ! BigInt::toString(-x).
    if (x.bigintValue() < 0n) {
      const str = X(BigIntValue.toString(Z(-x.bigintValue()))).stringValue();
      return new Value(`-${str}`);
    }
    // 2. Return the String value consisting of the code units of the digits of the decimal representation of x.
    return new Value(`${x.bigintValue()}`);
  }
}

BigIntValue.unit = new BigIntValue(1n);

/*
// #sec-binaryand
function BinaryAnd(x, y) {
  // 1. Assert: x is 0 or 1.
  Assert(x === 0n || x === 1n);
  // 2. Assert: y is 0 or 1.
  Assert(x === 0n || x === 1n);
  // 3. If x is 1 and y is 1, return 1.
  if (x === 1n && y === 1n) {
    return 1n;
  } else {
    // 4. Else, return 0.
    return 0n;
  }
}

// #sec-binaryor
function BinaryOr(x, y) {
  // 1. Assert: x is 0 or 1.
  Assert(x === 0n || x === 1n);
  // 2. Assert: y is 0 or 1.
  Assert(x === 0n || x === 1n);
  // 3. If x is 1 or y is 1, return 1.
  if (x === 1n || y === 1n) {
    return 1n;
  } else {
    // 4. Else, return 0.
    return 0n;
  }
}

// #sec-binaryxor
function BinaryXor(x, y) {
  // 1. Assert: x is 0 or 1.
  Assert(x === 0n || x === 1n);
  // 2. Assert: y is 0 or 1.
  Assert(x === 0n || x === 1n);
  // 3. If x is 1 and y is 0, return 1.
  if (x === 1n && y === 0n) {
    return 1n;
  } else if (x === 0n && y === 1n) {
    // Else if x is 0 and y is 1, return 1.
    return 1n;
  } else {
    // 4. Else, return 0.
    return 0n;
  }
}
*/

// #sec-bigintbitwiseop
function BigIntBitwiseOp(op, x, y) {
  // TODO: figure out why this doesn't work, probably the modulo.
  /*
  // 1. Assert: op is "&", "|", or "^".
  Assert(['&', '|', '^'].includes(op));
  // 2. Let result be 0n.
  let result = 0n;
  // 3. Let shift be 0.
  let shift = 0n;
  // 4. Repeat, until (x = 0 or x = -1) and (y = 0 or y = -1),
  while (!((x === 0n || x === -1n) && (y === 0n || y === -1n))) {
    // a. Let xDigit be x modulo 2.
    const xDigit = x % 2n;
    // b. Let yDigit be y modulo 2.
    const yDigit = y % 2n;
    // c. If op is "&", set result to result + 2^shift × BinaryAnd(xDigit, yDigit).
    if (op === '&') {
      result += (2n ** shift) * BinaryAnd(xDigit, yDigit);
    } else if (op === '|') {
      // d. Else if op is "|", set result to result + 2shift × BinaryOr(xDigit, yDigit).
      result += (2n ** shift) * BinaryXor(xDigit, yDigit);
    } else {
      // i. Assert: op is "^".
      Assert(op === '^');
      // ii. Set result to result + 2^shift × BinaryXor(xDigit, yDigit).
      result += (2n ** shift) * BinaryXor(xDigit, yDigit);
    }
    // f. Set shift to shift + 1.
    shift += 1n;
    // g. Set x to (x - xDigit) / 2.
    x = (x - xDigit) / 2n;
    // h. Set y to (y - yDigit) / 2.
    y = (y - yDigit) / 2n;
  }
  let tmp;
  // 5. If op is "&", let tmp be BinaryAnd(x modulo 2, y modulo 2).
  if (op === '&') {
    tmp = BinaryAnd(x % 2n, y % 2n);
  } else if (op === '|') {
    // 6. Else if op is "|", let tmp be BinaryOr(x modulo 2, y modulo 2).
    tmp = BinaryOr(x % 2n, y % 2n);
  } else {
    // a. Assert: op is "^".
    Assert(op === '^');
    // b. Let tmp be BinaryXor(x modulo 2, y modulo 2).
    tmp = BinaryXor(x % 2n, y % 2n);
  }
  // 8. If tmp ≠ 0, then
  if (tmp !== 0n) {
    // a. Set result to result - 2^shift. NOTE: This extends the sign.
    result -= 2n ** shift;
  }
  // 9. Return result.
  return Z(result);
  */
  switch (op) {
    case '&':
      return Z(x.bigintValue() & y.bigintValue());
    case '|':
      return Z(x.bigintValue() | y.bigintValue());
    case '^':
      return Z(x.bigintValue() ^ y.bigintValue());
    default:
      throw new OutOfRange('BigIntBitwiseOp', op);
  }
}

// #sec-object-type
export class ObjectValue extends Value {
  constructor(internalSlotsList) {
    super();

    this.properties = new ValueMap();
    this.internalSlotsList = internalSlotsList;
  }

  GetPrototypeOf() {
    return OrdinaryGetPrototypeOf(this);
  }

  SetPrototypeOf(V) {
    return OrdinarySetPrototypeOf(this, V);
  }

  IsExtensible() {
    return OrdinaryIsExtensible(this);
  }

  PreventExtensions() {
    return OrdinaryPreventExtensions(this);
  }

  GetOwnProperty(P) {
    return OrdinaryGetOwnProperty(this, P);
  }

  DefineOwnProperty(P, Desc) {
    return OrdinaryDefineOwnProperty(this, P, Desc);
  }

  HasProperty(P) {
    return OrdinaryHasProperty(this, P);
  }

  Get(P, Receiver) {
    return OrdinaryGet(this, P, Receiver);
  }

  Set(P, V, Receiver) {
    return OrdinarySet(this, P, V, Receiver);
  }

  Delete(P) {
    return OrdinaryDelete(this, P);
  }

  OwnPropertyKeys() {
    return OrdinaryOwnPropertyKeys(this);
  }

  // NON-SPEC
  mark(m) {
    m(this.properties);
    this.internalSlotsList.forEach((s) => {
      m(this[s]);
    });
  }
}

export class ReferenceRecord {
  constructor({
    Base,
    ReferencedName,
    Strict,
    ThisValue,
  }) {
    this.Base = Base;
    this.ReferencedName = ReferencedName;
    this.Strict = Strict;
    this.ThisValue = ThisValue;
  }

  // NON-SPEC
  mark(m) {
    m(this.Base);
    m(this.ReferencedName);
    m(this.ThisValue);
  }
}

export function Descriptor(O) {
  if (new.target === undefined) {
    return new Descriptor(O);
  }

  this.Value = O.Value;
  this.Get = O.Get;
  this.Set = O.Set;
  this.Writable = O.Writable;
  this.Enumerable = O.Enumerable;
  this.Configurable = O.Configurable;
}

Descriptor.prototype.everyFieldIsAbsent = function everyFieldIsAbsent() {
  return this.Value === undefined
    && this.Get === undefined
    && this.Set === undefined
    && this.Writable === undefined
    && this.Enumerable === undefined
    && this.Configurable === undefined;
};

// NON-SPEC
Descriptor.prototype.mark = function mark(m) {
  m(this.Value);
  m(this.Get);
  m(this.Set);
};

export class DataBlock extends Uint8Array {
  constructor(sizeOrBuffer, ...restArgs) {
    if (sizeOrBuffer instanceof ArrayBuffer) {
      // fine.
      super(sizeOrBuffer, ...restArgs);
    } else {
      Assert(typeof sizeOrBuffer === 'number');
      super(sizeOrBuffer);
    }
  }
}

export function Type(val) {
  if (val instanceof UndefinedValue) {
    return 'Undefined';
  }

  if (val instanceof NullValue) {
    return 'Null';
  }

  if (val instanceof BooleanValue) {
    return 'Boolean';
  }

  if (val instanceof StringValue) {
    return 'String';
  }

  if (val instanceof NumberValue) {
    return 'Number';
  }

  if (val instanceof BigIntValue) {
    return 'BigInt';
  }

  if (val instanceof SymbolValue) {
    return 'Symbol';
  }

  if (val instanceof ObjectValue) {
    return 'Object';
  }

  if (val instanceof Completion) {
    return 'Completion';
  }

  if (val instanceof EnvironmentRecord) {
    return 'EnvironmentRecord';
  }

  if (val instanceof Descriptor) {
    return 'Descriptor';
  }

  if (val instanceof DataBlock) {
    return 'Data Block';
  }

  throw new OutOfRange('Type', val);
}

// Used for Type(x)::y
export function TypeForMethod(val) {
  if (val instanceof Value) {
    return val.constructor;
  }
  throw new OutOfRange('TypeForValue', val);
}
