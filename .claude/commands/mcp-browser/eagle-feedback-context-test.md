---
description: Test EAGLE feedback with conversation context — verify snapshot, page, and last_message_id are captured and submitted correctly after a real acquisition conversation
argument-hint: [url]
---

# EAGLE Feedback Context Test

Tests the full feedback submission pipeline including the conversation snapshot, page path, and
last_message_id fields added in the b6f4bc5 commit. Opens a real acquisition chat, sends two
messages to build context, then submits feedback via Ctrl+J and verifies the API payload carries
the snapshot and message ID.

## Variables

| Variable | Value | Description |
| -------- | ----- | ----------- |
| SKILL | `claude-bowser` | Uses your real Chrome (DevTools required) |
| MODE | `headed` | Visible browser |
| URL | `{PROMPT}` or `http://localhost:3000` | Base URL |

If {PROMPT} contains a URL use it, otherwise default to `http://localhost:3000`.

---

## Pre-flight

1. Navigate to `{URL}/chat`
2. Wait up to 10 seconds for the page to load
3. If a login page appears, report **FAIL — Not authenticated** and stop
4. Click "New Chat" to start a clean session
5. Take a screenshot — save as `fb-ctx-00-preflight.png`

---

## Phase 1: Build Conversation Context

This gives the feedback snapshot real content to capture.

6. Click the chat textarea and type exactly:
   `I need to draft an IGCE for a $750,000 lab equipment procurement at NCI. Equipment includes two mass spectrometers and a flow cytometer.`
7. Press Enter and wait up to 60 seconds for EAGLE to respond
8. Take a screenshot — save as `fb-ctx-01-first-response.png`
9. Verify an EAGLE response bubble appeared with acquisition-relevant content
10. Note the content of the EAGLE response — this becomes the conversation snapshot

11. Click the textarea and type exactly:
    `What FAR clauses apply and do we need a sole source justification?`
12. Press Enter and wait up to 60 seconds for EAGLE to respond
13. Take a screenshot — save as `fb-ctx-02-second-response.png`
14. Verify a second EAGLE response appeared
15. Note: this second response's message ID becomes `last_message_id`

---

## Phase 2: Open DevTools Network Panel

Before opening the feedback modal, set up network monitoring to intercept the API call.

16. Open Chrome DevTools (`F12` or right-click → Inspect)
17. Click the **Network** tab
18. In the filter box type `feedback` to filter network requests
19. Make sure **XHR** or **Fetch** is selected (not All, to reduce noise)
20. Take a screenshot — save as `fb-ctx-03-devtools-ready.png`

---

## Phase 3: Open and Complete Feedback Modal

21. Press `Control+j` to open the feedback modal
22. Wait up to 3 seconds for the modal to appear
23. Take a screenshot — save as `fb-ctx-04-modal-open.png`
24. Verify the modal appeared with:
    - Title: "Send Feedback"
    - 4 pill buttons: Helpful, Inaccurate, Incomplete, Too verbose
    - Textarea with placeholder "Tell us more..."
    - Cancel and Submit buttons
25. Click the **"Helpful"** pill — verify it highlights blue
26. Click the textarea and type: `EAGLE gave accurate FAR clause guidance for the lab equipment procurement.`
27. Take a screenshot — save as `fb-ctx-05-modal-filled.png`
28. Verify the Submit button is enabled

---

## Phase 4: Submit and Capture Network Payload

29. Click the **Submit** button
30. Immediately watch the DevTools Network panel for a request to `/api/feedback`
31. Wait up to 5 seconds for the submission to complete
32. Take a screenshot of the modal success state — save as `fb-ctx-06-submitted.png`
33. Verify the success state shows:
    - Green check mark icon
    - "Thanks!" text
    - Cancel/Submit buttons are gone

---

## Phase 5: Inspect the Network Request

34. In DevTools Network, click the `/api/feedback` request that appeared
35. Click the **Payload** or **Request** tab to see the POST body
36. Take a screenshot of the request payload — save as `fb-ctx-07-network-payload.png`
37. Verify the payload contains **all of**:
    - `"page": "/chat"` — the current route
    - `"last_message_id":` — a non-empty string (the ID of the second EAGLE response)
    - `"conversation_snapshot":` — a non-empty value (the messages array or JSON blob)
    - `"feedback_type":` — either the detected type or `"Helpful"`
    - `"session_id":` — a non-empty string

38. Click the **Response** tab and verify:
    - HTTP status is `200` or `201`
    - Response body contains `"feedback_id"` — confirms DynamoDB write succeeded
    - Take a screenshot — save as `fb-ctx-08-api-response.png`

---

## Phase 6: Verify Snapshot Content

39. Go back to the **Payload** tab and expand `conversation_snapshot`
40. Verify the snapshot contains the actual conversation messages — should include:
    - The IGCE/lab equipment question from Phase 1
    - The FAR clauses question from Phase 1
    - Both EAGLE responses (not empty/placeholder text)
41. Take a screenshot — save as `fb-ctx-09-snapshot-content.png`

---

## Phase 7: Modal Reset

42. Close DevTools
43. Verify the feedback modal has auto-closed (or close it via Escape)
44. Press `Control+j` to reopen the modal
45. Verify the form is fresh:
    - No pill selected
    - Textarea is empty
    - Title reads "Send Feedback" (not stuck in success state)
46. Press `Escape` to close
47. Take a screenshot — save as `fb-ctx-10-modal-reset.png`

---

## Phase 8: Report Results

Report **PASS** or **FAIL** for each check:

| Check | Expected | Actual | Result |
|-------|----------|--------|--------|
| Page loaded | Chat UI visible | | |
| First EAGLE response | Acquisition content, non-empty | | |
| Second EAGLE response | FAR/clause content, non-empty | | |
| DevTools network filter ready | `/api/feedback` request visible after submit | | |
| Modal opens on Ctrl+J | "Send Feedback" modal appears | | |
| 4 feedback type pills | Helpful, Inaccurate, Incomplete, Too verbose | | |
| Pill selection works | Helpful highlighted blue | | |
| Comment accepted | Typed text appears in textarea | | |
| Submit button enabled | Not disabled after typing | | |
| Success state shown | Green check + "Thanks!" | | |
| Network request captured | `/api/feedback` POST visible in DevTools | | |
| `page` field present | `"/chat"` in payload | | |
| `last_message_id` present | Non-empty string in payload | | |
| `conversation_snapshot` present | Non-empty in payload | | |
| Snapshot contains real messages | IGCE + FAR questions + responses | | |
| API returned 200/201 | HTTP success status | | |
| `feedback_id` in response | DynamoDB write confirmed | | |
| Modal resets after close | Empty form, no stuck success state | | |

**Overall result**: PASS only if ALL 18 checks pass.

If any check fails, include:
- Whether the `/api/feedback` request appeared at all in DevTools
- Which payload fields were missing or empty
- Whether `conversation_snapshot` was `null`, `[]`, or contained the right messages
- Whether `last_message_id` matched any visible message ID in the chat
- Whether the API returned an error status and what the error body said
- Whether the FeedbackContext provider was mounted (check React DevTools if available)
- Any console errors related to `useFeedback`, `getSnapshot`, or `FeedbackProvider`
