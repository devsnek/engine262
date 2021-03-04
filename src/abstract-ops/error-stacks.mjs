import { Q, X } from '../completion.mjs';
import { CallSite } from '../helpers.mjs';
import { Type, Value } from '../value.mjs';
import { Assert, ToString } from './all.mjs';

export class StackFrameRecord {
  constructor({
    Name,
    Source,
    Span,
    callSite,
  }) {
    Assert(typeof Name === 'string');
    Assert(typeof Source === 'string' || Source instanceof StackFrameRecord);
    Assert(Span === undefined || Span instanceof StackFrameSpanRecord);
    Assert(callSite === undefined || callSite instanceof CallSite);

    this.Name = Name;
    this.Source = Source;
    this.Span = Span;
    this.callSite = callSite;
  }
}

export class StackFrameSpanRecord {
  constructor({ StartPosition, EndPosition }) {
    Assert(StartPosition instanceof StackFramePositionRecord);
    Assert(EndPosition === undefined || EndPosition instanceof StackFramePositionRecord);

    this.StartPosition = StartPosition;
    this.EndPosition = EndPosition;
  }
}

export class StackFramePositionRecord {
  constructor({ Line, Column }) {
    Assert(typeof Line === 'number');
    Assert(Column === undefined || typeof Column === 'number');

    this.Line = Line;
    this.Column = Column;
  }
}

export function GetStackString(error) {
  // 1. Assert: error is an object that has an [[ErrorData]] internal slot.
  Assert(Type(error) === 'Object' && 'ErrorData' in error);
  // 2. Let errorString be ? ToString(error).
  let stackString = Q(ToString(error)).stringValue();
  // 3. For each Stack Frame Record frame of error.[[ErrorData]], do
  for (const frame of error.ErrorData) {
    // a. Let frameString be ! GetStackFrameString(frame).
    const frameString = X(GetStackFrameString(frame)).stringValue();
    // b. Set stackString to the concatenation of stackString, the code unit 0x000A (LINE FEED), the code unit 0x0020 (SPACE), and frameString.
    stackString += `\n   ${frameString}`;
  }
  // 4. Return stackString.
  return new Value(stackString);
}

export function GetStackFrameString(frame) {
  let sourceString;
  // 1. If frame.[[Source]] is a Stack Frame Record, then
  if (frame.Source instanceof StackFrameRecord) {
    // a. Let sourceFrameString be ! GetStackFrameString(frame.[[Source]]).
    const sourceFrameString = X(GetStackFrameString(frame.Source)).stringValue();
    // b. Let sourceString be the string-concatenation of "eval" and sourceFrameString.
    sourceString = `eval${sourceFrameString}`;
  } else { // 2. Else,
    // a. Assert: Type(frame.[[Source]]) is String.
    Assert(typeof frame.Source === 'string');
    // b. Let sourceString be frame.[[Source]].
    sourceString = frame.Source;
  }
  // 3. Let spanString be the empty string.
  let spanString = '';
  // 4. If source.[[Span]] is not empty, set spanString to ! GetStackFrameSpanString(source.[[Span]]).
  if (frame.Span !== undefined) {
    spanString = X(GetStackFrameSpanString(frame.Span)).stringValue();
  }
  // 5. Let frameString be the string-concatenation of the code unit 0x0020 (SPACE), "at", and the code unit 0x0020 (SPACE).
  let frameString = ' at ';
  // 6. If frame.[[Name]] is not the empty string, set frameString to the string-concatenation of frameString, frame.[[Name]], and the code unit 0x0020 (SPACE).
  if (frame.Name) {
    frameString += `${frame.Name} `;
  }
  // 7. Return the string-concatenation of frameString, "(", sourceString, spanString, and ")".
  return new Value(`${frameString}(${sourceString}${spanString})`);
}

export function GetStackFrameSpanString(span) {
  // 1. Let startPositionString be ! GetStackFramePositionString(span.[[StartPosition]]).
  const startPositionString = X(GetStackFramePositionString(span.StartPosition)).stringValue();
  // 2. If span.[[EndPosition]] is not empty, then
  if (span.EndPosition !== undefined) {
    // a. Let endPositionString be ! GetStackFramePositionString(span.[[EndPosition]]).
    const endPositionString = X(GetStackFramePositionString(span.EndPosition)).stringValue();
    // b. Return the string-concatenation of startPositionString, "::", and endPositionString.
    return new Value(`${startPositionString}::${endPositionString}`);
  }
  // 3. Return startPositionString.
  return new Value(startPositionString);
}

export function GetStackFramePositionString(position) {
  // 1. Let lineString be ! ToString(𝔽(position.[[Line]])).
  const lineString = X(ToString(new Value(position.Line))).stringValue();
  // 2. If position.[[Column]] is not empty, then
  if (position.Column !== undefined) {
    // a. Let columnString be ! ToString(𝔽(position.[[Column]])).
    const columnString = X(ToString(new Value(position.Column))).stringValue();
    // b. Return the string-concatenation of positionString, ":", and columnString.
    return new Value(`${lineString}:${columnString}`);
  }
  // 3. Return lineString.
  return new Value(lineString);
}
