# JPG Match Regression QA

Use this checklist before starting a new I Like JPGs module, after changing JPG Match logic, or before demoing the app.

## Current Active Module

JPG Match

Users select NFT collections as taste signals, then discover wallets that hold overlap across those collections.

## Non-Negotiables

Do not introduce:

- floor price language
- rarity language
- offers language
- trading language
- portfolio value
- wallet valuation
- financial advice
- investment framing

## QA Commands

Run TypeScript:

    npx tsc --noEmit

Collection search:

    curl -s "http://localhost:3000/api/jpgs/collections/search?q=kamagang&debug=1" | python3 -m json.tool
    curl -s "http://localhost:3000/api/jpgs/collections/search?q=squigg&debug=1" | python3 -m json.tool
    curl -s "http://localhost:3000/api/jpgs/collections/search?q=fiden&debug=1" | python3 -m json.tool
    curl -s "http://localhost:3000/api/jpgs/collections/search?q=vee&debug=1" | python3 -m json.tool

Expected first results:

- kamagang -> Kamagang
- squigg -> Chromie Squiggle by Snowfro
- fiden -> Fidenza by Tyler Hobbs
- vee -> VeeFriends

## Wallet Discovery QA

Run wallet discovery with CryptoPunks and BAYC from the README or terminal history.

Expected:

- ranked wallet matches return
- each wallet has displayName
- each wallet has openseaProfileUrl
- hydrationSummary limit is 10
- hydrationSummary concurrency is 2
- no market or trading language appears in the UI

## Before Starting a New Module

Confirm:

- TypeScript passes
- collection search still works
- wallet discovery still works
- JPG Match behavior has not been rewritten unintentionally
