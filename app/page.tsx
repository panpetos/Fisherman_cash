import styles from "./page.module.css";

export default function Home() {
  return (
    <main className={styles["main-container"]}>
      <div className={styles["hero-section"]}>
        <h1 className={styles.title}>Fisherman Cash</h1>
        <p className={styles.description}>
          Welcome to your fisherman cash management application
        </p>
      </div>
    </main>
  );
}
