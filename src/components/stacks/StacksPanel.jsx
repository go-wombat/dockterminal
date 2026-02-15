import StackGroup from './StackGroup';

export default function StacksPanel({ stacks, expandedStacks, onToggleStack, selectedContainerId, onSelectContainer, onStackAction }) {
  return (
    <div style={{ flex: 1, overflow: "auto" }}>
      {stacks.map((stack, si) => (
        <StackGroup
          key={stack.name}
          stack={stack}
          index={si}
          expanded={expandedStacks.has(stack.name)}
          onToggle={() => onToggleStack(stack.name)}
          selectedContainerId={selectedContainerId}
          onSelectContainer={onSelectContainer}
          onStackAction={onStackAction}
        />
      ))}
    </div>
  );
}
