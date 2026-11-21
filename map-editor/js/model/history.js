// Undo and redo using snapshots of the map.
const History = (() => {
  const LIMIT = 50;
  let undoStack = [];
  let redoStack = [];

  // Clears all history (new or opened map).
  function reset() { undoStack = []; redoStack = []; }

  // Call before changing the map.
  function record(map) {
    undoStack.push(MapModel.snapshot(map));
    if (undoStack.length > LIMIT) undoStack.shift();
    redoStack = [];
  }

  // Steps back. Returns true if something changed.
  function undo(map) {
    if (!undoStack.length) return false;
    redoStack.push(MapModel.snapshot(map));
    MapModel.restore(map, undoStack.pop());
    return true;
  }

  // Steps forward. Returns true if something changed.
  function redo(map) {
    if (!redoStack.length) return false;
    undoStack.push(MapModel.snapshot(map));
    MapModel.restore(map, redoStack.pop());
    return true;
  }

  function canUndo() { return undoStack.length > 0; }
  function canRedo() { return redoStack.length > 0; }

  return { reset, record, undo, redo, canUndo, canRedo };
})();
