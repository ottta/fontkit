import AATStateMachine from './AATStateMachine';
import AATLookupTable from './AATLookupTable';

const PUSH_MASK = 0x8000;
const VALUE_OFFSET_MASK = 0x3fff;
const RESET_CROSS_STREAM_KERNING = -0x8000;
const STACK_SIZE = 8;

export default class AATKernProcessor {
  constructor(table) {
    this.version = table.version;
    this.format = table.format;
    this.coverage = table.coverage;
    this.stateMachine = new AATStateMachine(table.subtable.stateTable);
    this.valueTable = table.subtable.valueTable;
    this.stateTableOffset = table.subtable._startOffset;
    this.valueTableBase = this.valueTable.base - table.subtable._startOffset;
  }

  process(glyphs, positions) {
    let advance = this.coverage.crossStream ? 'yAdvance' : 'xAdvance';
    let offset = this.coverage.crossStream ? 'yOffset' : 'xOffset';

    let stack = [];
    let advancesSoFar = 0;

    this.stateMachine.process(glyphs, false, (glyph, entry, index) => {
      if (entry.flags & PUSH_MASK) {
        if (stack.length === STACK_SIZE) {
          stack.shift();
        }

        stack.push(index);
      }

      let valueOffset = entry.flags & VALUE_OFFSET_MASK;
      if (valueOffset !== 0) {
        let actionIndex = ((this.stateTableOffset + valueOffset) - this.valueTable.base) >> 1;
        let action = 0;

        while (stack.length > 0 && !(action & 1)) {
          action = this.valueTable.getItem(actionIndex++);
          let value = action & ~1;
          let glyphIndex = stack.pop();

          if (this.coverage.crossStream && value === RESET_CROSS_STREAM_KERNING) {
            positions[glyphIndex][advance] = -advancesSoFar;
            positions[glyphIndex][offset] = -advancesSoFar;
            advancesSoFar = 0;
          } else {
            positions[glyphIndex][advance] += value;
            positions[glyphIndex][offset] += value;
            advancesSoFar += value;
          }
        }
      }

      // if (entry.newState === 0 || entry.newState === 1) {
        stack.length = 0;
      // }
    });
  }
}