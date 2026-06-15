# Orphaned slashed Stake goes to the protocol treasury, never the Requester

When a Round meets Quorum but every Worker scores sub-threshold (e.g. all Workers report
the same fixed answer — all slashed, none above-threshold), the forfeited Stake has no
honest Worker to be redistributed to. That orphaned Stake goes to a **protocol treasury**
bucket, not to the Requester. Gifting it to the Requester — who did no honest work and is
barred from being a Worker in their own Round — would create a faint perverse incentive to
post Rounds hoping they collapse. In v1 the "treasury" is simply Stake the Escrow contract
retains (effectively burned); it can later be directed to a real treasury address.

## Consequences

- Settlement carries a distinct `treasury` amount; money conservation is
  `escrow + Σstake = Σreward + ΣstakeReturned + Σredistribution + requesterRefund + treasury`.
- The Requester's own Escrow still refunds in full in this case (no rewards were paid); only
  the colluders' forfeited Stake is withheld from them.
