// Simple text progress bar for CLI
export class ProgressBar {
  private total: number;
  private current: number = 0;
  private barLength: number;
  private label: string;

  constructor(total: number, label = "Loading", barLength = 30) {
    this.total = total;
    this.barLength = barLength;
    this.label = label;
    this.render();
  }

  tick() {
    this.current++;
    this.render();
  }

  render() {
    const percent = this.total === 0 ? 1 : this.current / this.total;
    const filled = Math.round(percent * this.barLength);
    const empty = this.barLength - filled;
    const bar = "█".repeat(filled) + "░".repeat(empty);
    const pct = Math.round(percent * 100);
    process.stdout.write(`\r${this.label}: [${bar}] ${pct}% (${this.current}/${this.total})`);
    if (this.current === this.total) {
      process.stdout.write("\n");
    }
  }
}
