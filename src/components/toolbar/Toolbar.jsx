import styles from './Toolbar.module.css';

export default function Toolbar({ onCompose, onRestartAll, onPullImages, onPrune, stackSearch, onStackSearchChange }) {
  return (
    <div className={styles.toolbar}>
      <button className={styles.btnPrimary} onClick={onCompose}>
        + COMPOSE
      </button>
      <button className={styles.btn} onClick={onRestartAll}>
        &#x27F3; RESTART ALL
      </button>
      <button className={styles.btn} onClick={onPullImages}>
        &#x2193; PULL IMAGES
      </button>
      <button className={styles.btnDanger} onClick={onPrune}>
        &#x2327; PRUNE
      </button>

      <div className={styles.searchBox}>
        <span className={styles.searchIcon}>&#x2315;</span>
        <input
          className={styles.searchInput}
          value={stackSearch}
          onChange={e => onStackSearchChange(e.target.value)}
          placeholder="filter stacks..."
          spellCheck={false}
        />
        {stackSearch && (
          <span className={styles.searchClear} onClick={() => onStackSearchChange("")}>
            &#x2715;
          </span>
        )}
      </div>
    </div>
  );
}
