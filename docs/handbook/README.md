# Sub for Santa handbook: user journeys and annotated mockups

Every screen below was captured from the clickable prototype by driving it through each flow, then annotated. Blue pins on a mockup match the numbered notes beside it. J1 is the one screen that is proposed, not captured.

- [Journey map](00-journey-map.html) ([PNG](00-journey-map.png)): who does what, and when, across all personas
- [Personas](01-personas.html) ([PNG](01-personas.png))

Each mockup is a standalone `.html` file with a `.png` render next to it in `mockups/`.

## Donor

| ID | Screen | Job | Arrives from | Goes to |
|---|---|---|---|---|
| D1 | [Landing](mockups/D1-Landing.html) | Decide whether this drive is real and worth a minute. | A shared link | D2 Browse families |
| D2 | [Browse families](mockups/D2-Browse-families.html) | Find a household you can realistically cover. | D1 Landing | D3 Family story |
| D3 | [Family story](mockups/D3-Family-story.html) | Read enough to commit. | D2 Browse families | D4 Claim, or D9 if someone claims first |
| D4 | [Claim: your details](mockups/D4-Claim.html) | Give the minimum and commit. | D3 Family story | D5 Confirmed |
| D5 | [Confirmed](mockups/D5-Confirmed.html) | Know exactly what to do next. | D4 Claim | D6 My families |
| D6 | [My families](mockups/D6-My-families.html) | Shop, track, hand over. | D5 Confirmed | D7 once delivered, D8 if plans change |
| D7 | [Delivered, with a thank-you](mockups/D7-Delivered-and-thanked.html) | Close the loop. | D6, after the coordinator records a note (A4) | End of the donor journey |
| D8 | [Release a family](mockups/D8-Release-a-family.html) | Back out without stranding the household. | D6 My families | D6; the household returns to D2 |
| D9 | [Someone claimed it first](mockups/D9-Just-sponsored.html) | Lose the race without losing the donor. | D3 or D4, when another sponsor confirms first | D2 Browse families |
| D10 | [Browse on a phone](mockups/D10-Browse-on-a-phone.html) | The same list, one thumb. Every prototype screen reflows this way. | D1 Landing | D3 Family story |

## Co-sponsor

| ID | Screen | Job | Arrives from | Goes to |
|---|---|---|---|---|
| J1 | [Co-sponsor joins](mockups/J1-Co-sponsor-joins.html) (proposed) | Join a household a friend already claimed. | The invite link from D4 | D6 My families, shared |

## Caseworker

| ID | Screen | Job | Arrives from | Goes to |
|---|---|---|---|---|
| C1 | [Referral form](mockups/C1-Referral-form.html) | Put a household forward without exposing it. | The footer link on D1 | C2 Pending review |
| C2 | [Pending review](mockups/C2-Pending-review.html) | Know it landed and what happens next. | C1 Referral form | C3 if changes are requested, C4 if approved |
| C3 | [Changes requested](mockups/C3-Changes-requested.html) | Fix one thing and send it back. | A2, when the coordinator requests changes | A2 again |
| C4 | [Published](mockups/C4-Published.html) | Confirm the household is live, and safely so. | A2, on approval | D3, to see the public story |

## Coordinator

| ID | Screen | Job | Arrives from | Goes to |
|---|---|---|---|---|
| A1 | [Dashboard](mockups/A1-Dashboard.html) | See the whole drive in one look. | Coordinator sign-in | A2 Approval queue, A3 Exceptions |
| A2 | [Approval queue](mockups/A2-Approval-queue.html) | Publish only what is safe to publish. | A1, or a new referral from C1 | C3 on changes, C4 and D2 on approval |
| A3 | [Exceptions and activity log](mockups/A3-Exceptions.html) | Catch what falls out of the happy path. | A1 Needs attention | A4 for a thank-you, A2 for a flag |
| A4 | [Record a thank-you](mockups/A4-Record-a-thank-you.html) | Carry a household’s thanks to its sponsor. | A3 Exceptions | D7, on the sponsor’s side |
| A5 | [Drive settings and close-out](mockups/A5-Drive-settings.html) | Set the season up, then shut it down cleanly. | Before the drive opens; again after drop-off | A6 Roster export |
| A6 | [Roster export](mockups/A6-Roster-export.html) | Take the record out of the app. | A3 or A5 | A spreadsheet |

## Personas without screens

- Household: no login. Consents through the caseworker (C1), thanks the sponsor through the coordinator (A4, D7).
- Offline sponsor: phones the office; the coordinator records a manual match (A3).
- Public viewer: can read D1 to D3. The exception queue expects viewer flags, but no flag control exists.

## Gaps and open questions, by screen

**D1 Landing**

- "How it works" opens the prototype help panel, not the three steps below it.
- No sign-in. Caseworker and coordinator entry need accounts in the build.

**D2 Browse families**

- Both filter buttons do nothing yet.
- The whole row opens the story. The Sponsor button inside it does the same; it does not start a claim.

**D3 Family story**

- No control to flag a story, although the exception queue (A3) expects viewer flags.
- No way to give money instead of gifts. A Stripe link, if added, belongs in this panel.

**D4 Claim: your details**

- Account creation would happen here; the prototype has none.
- The commitment box is pre-ticked and cannot be unticked.
- The per-sponsor cap (A5) is not checked on confirm.

**D5 Confirmed**

- Conflicts with the project rule that no family PII is stored. Gifts go to the organization and the coordinator sorts them by household, so a sponsor may not need a family contact at all.
- Print shows a message only.

**D6 My families**

- Every household reads "claimed just now".
- A co-sponsor’s ticks are not told apart from the sponsor’s.

**D7 Delivered, with a thank-you**

- "I can no longer sponsor" is still offered after delivery.

**D8 Release a family**

- No reason is asked for.

**D9 Someone claimed it first**

- The build needs this check on the server, as one atomic claim.

**J1 Co-sponsor joins**

- Not in the prototype. There, confirming a split adds "Jordan T." automatically.
- Undecided: whether the link expires, whether a co-sponsor counts toward the cap, whether a co-sponsor can release the household.

**C1 Referral form**

- Section 4 stores a family name and phone, against the project rule of no family PII.
- "Add another person", "Remove" and "Save draft" do nothing yet.
- Submitting works with the first two consents unticked.

**C2 Pending review**

- Tracks one referral. There is no list of everything a caseworker has submitted.

**C3 Changes requested**

- "Edit and resubmit" resubmits at once. There is no edit step.

**C4 Published**

- The last timeline step never completes, even after a sponsor claims the household.

**A1 Dashboard**

- The "Updated" column shows the referral date.
- "Open" works only for households that are live.

**A2 Approval queue**

- The school check is one keyword match.
- "Required" is not enforced; a default note is filled in.
- "Reveal for review" does nothing yet.

**A3 Exceptions and activity log**

- The offline-sponsor card always shows, for the first open household.
- "Message the family" and "Call sponsor" do nothing yet.
- Viewers have no control that raises a flag.

**A4 Record a thank-you**

- The message arrives pre-filled with sample text.
- Photo consent is not asked for here.

**A5 Drive settings and close-out**

- These fields are not wired to the rest of the site.
- "Close the drive" does nothing yet.
- One drive is assumed. A second campaign would need a switcher above this screen.

**A6 Roster export**

- Pending referrals are not in the export.

