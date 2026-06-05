//! Per-tick success/failure accounting for background workers.
//!
//! Several workers iterate over many units (sites, keys, …) and log-and-continue
//! on a per-unit error. Without a summary, a tick where half the units failed
//! looks identical to a clean run — on-call has no signal of partial failure.
//!
//! [`TickReport`] counts ok/failed units and, at the end of a tick, logs a
//! summary that escalates to `warn` (with the `failed` count as the alertable
//! metric) whenever any unit failed.

/// Accumulates per-unit outcomes for one worker tick.
#[must_use = "call finish() to emit the per-tick summary"]
pub struct TickReport {
    worker: &'static str,
    ok: u64,
    failed: u64,
}

impl TickReport {
    pub fn new(worker: &'static str) -> Self {
        Self {
            worker,
            ok: 0,
            failed: 0,
        }
    }

    /// Count one successful unit.
    pub fn ok(&mut self) {
        self.ok += 1;
    }

    /// Count one failed unit.
    pub fn fail(&mut self) {
        self.failed += 1;
    }

    /// Count a unit by its `Result`, incrementing ok or failed.
    pub fn record<T, E>(&mut self, outcome: &Result<T, E>) {
        if outcome.is_ok() {
            self.ok += 1;
        } else {
            self.failed += 1;
        }
    }

    /// Number of failed units recorded so far.
    pub fn failed_count(&self) -> u64 {
        self.failed
    }

    /// Number of successful units recorded so far.
    pub fn ok_count(&self) -> u64 {
        self.ok
    }

    /// Emit the per-tick summary. `warn` (the `failed` field is the metric to
    /// alert on) when any unit failed; `info` otherwise.
    pub fn finish(self) {
        if self.failed > 0 {
            tracing::warn!(
                worker = self.worker,
                ok = self.ok,
                failed = self.failed,
                "worker tick completed with failures"
            );
        } else {
            tracing::info!(
                worker = self.worker,
                ok = self.ok,
                failed = self.failed,
                "worker tick completed"
            );
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn record_counts_ok_and_failed_outcomes() {
        let mut report = TickReport::new("test");
        report.record::<(), ()>(&Ok(()));
        report.record::<(), ()>(&Err(()));
        report.record::<(), ()>(&Ok(()));
        assert_eq!(report.ok_count(), 2);
        assert_eq!(report.failed_count(), 1);
    }

    #[test]
    fn manual_ok_and_fail_increment_independently() {
        let mut report = TickReport::new("test");
        report.ok();
        report.fail();
        report.fail();
        assert_eq!(report.ok_count(), 1);
        assert_eq!(report.failed_count(), 2);
    }
}
