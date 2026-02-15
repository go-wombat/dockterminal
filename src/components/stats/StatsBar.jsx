import styles from './StatsBar.module.css';

export default function StatsBar({
  stackCount, stacksRunning, stacksDegraded,
  cpuPercent, physicalCores, logicalCores,
  usedMemMb, totalMemMb,
  dockerTotal, dockerRunning, dockerStopped,
}) {
  const stats = [
    { label: "STACKS", value: `${stackCount}`, sub: `${stacksRunning} running${stacksDegraded > 0 ? ` \u2022 ${stacksDegraded} degraded` : ""}` },
    { label: "CPU LOAD", value: `${cpuPercent.toFixed(1)}%`, sub: `${physicalCores}C / ${logicalCores}T` },
    { label: "MEMORY", value: `${usedMemMb}MB`, sub: `/ ${totalMemMb}MB` },
    { label: "CONTAINERS", value: `${dockerTotal}`, sub: `${dockerRunning} active \u2022 ${dockerStopped} stopped` },
  ];

  return (
    <div className={styles.bar}>
      {stats.map((stat, i) => (
        <div key={i} className={styles.cell}>
          <div className={styles.label}>{stat.label}</div>
          <div className={styles.value}>{stat.value}</div>
          <div className={styles.sub}>{stat.sub}</div>
        </div>
      ))}
    </div>
  );
}
