export type InteractionState = 'idle' | 'selecting' | 'dragging' | 'resizing' | 'rotating' | 'panning';

export interface InteractionMachine {
  state: InteractionState;
}

const ALLOWED: Record<InteractionState, InteractionState[]> = {
  idle: ['selecting', 'dragging', 'resizing', 'rotating', 'panning'],
  selecting: ['idle', 'dragging'],
  dragging: ['idle'],
  resizing: ['idle'],
  rotating: ['idle'],
  panning: ['idle'],
};

export function createInteractionMachine(): InteractionMachine {
  return { state: 'idle' };
}

export function transitionInteraction(machine: InteractionMachine, next: InteractionState): boolean {
  if (machine.state === next) return true;
  const allowed = ALLOWED[machine.state];
  if (!allowed.includes(next)) return false;
  machine.state = next;
  return true;
}

export function resetInteraction(machine: InteractionMachine) {
  machine.state = 'idle';
}

export function isInteractionBusy(machine: InteractionMachine) {
  return machine.state === 'dragging' || machine.state === 'resizing' || machine.state === 'rotating';
}

