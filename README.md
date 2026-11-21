# ASLP App Kit

Starter template for every app in this series, with a pure-tone average calculator (WHO 2021 grading, live audiogram) as the demo.

Part of the ASLP App Kit series (phase 0) by Hemaraja Nayaka S, Department of Audiology & Speech-Language Pathology, Yenepoya Medical College Hospital, Mangaluru.

- **For:** Audiologists, students
- **Languages:** English, Kannada, Telugu, Hindi
- **Data:** stays in the browser on the device where it is entered. Nothing is sent to a server. Use the CSV or backup download regularly.
- **Works offline** after the first visit, and can be added to a phone's home screen.

## Files

| File | What it does |
|---|---|
| `index.html` | The app |
| `sw.js` | Keeps a copy on the device so the app works offline |
| `manifest.webmanifest`, `icon.svg` | Name and icon when installed on a phone |
| `vercel.json` | Stops Vercel caching the offline file, so updates reach users |

## Publish on Vercel (no terminal needed)

1. Push this folder to its own GitHub repository.
2. In Vercel, choose **Add New → Project**, pick the repository and press **Deploy**. No build settings are needed.
3. Every change committed to GitHub goes live within a minute. After changing the app, raise the version in `sw.js` (for example `-v1` to `-v2`) so phones fetch the new copy.

## Status

Version 0.1.0: a working draft for clinical review. Clinical content, word lists and translations should be checked by a qualified professional and native speakers before use with patients.

## Making a new app

The `kit/` folder holds the shared `kit.css`, `kit.js`, the offline file template and `newapp.sh`, which creates a new app folder with all of them. Each app in the series carries its own copy, so every app can live in its own repository.

## Apps in the series

| Phase | App | Repository |
|---|---|---|
| 0 | ASLP App Kit | `aslp-app-kit` |
| 1.1 | Safe Swallow Kitchen | `safe-swallow-kitchen` |
| 1.2 | Myth or Fact | `parent-myth-check` |
| 1.3 | Sound Allowance | `sound-allowance` |
| 1.4 | Word Set Maker | `word-set-maker` |
| 2.1 | Ototoxicity Monitor | `ototox-monitor` |
| 2.2 | Newborn Hearing Follow-up | `newborn-followup` |
| 2.3 | Two-Language Profile | `two-language-profile` |
| 2.4 | Hearing Aid Bank | `hearing-aid-bank` |
| 2.5 | Performer Ear Log | `performer-ear-log` |
| 3.1 | Swallow Review | `swallow-review` |
| 3.2 | Check Your Therapist | `verify-therapist` |
| 3.3 | Case Conference Room | `case-conference` |
| 3.4 | AI Report Checker | `ai-report-checker` |
| 3.5 | Conversation Coach | `conversation-coach` |
| 4.1 | Interview Practice | `stutter-interview` |
| 4.2 | Hearing-Friendly Venue Audit | `venue-hearing-audit` |
| 4.3 | Conversation Group Kit | `conversation-group-kit` |
| 4.4 | Carnatic Ear Training | `carnatic-ear-training` |
| 4.5 | Hearing Change Tracker | `hearing-change-tracker` |
