# Nimbus Frontend Redesign - Agent Output

## Files changed
- `frontend/src/App.jsx`
- `frontend/src/api/nimbusClient.js`
- `frontend/src/styles.css`

## Reports page overhaul
- `ReportsPage` renders selected-region report cards through `ReportCard`.
- The report list is filtered by the active region and calls `/summaries?region=<selectedRegion>`.
- The Generate report button passes the selected region and refreshes only that region's reports.
- Report cards show the selected region label, Pacific-time generated timestamp, Pacific-time rolling 24h data window, percent saved, CO2 avoided, vCPU-hours shifted, and clean share.
- Percent saved uses paused/dirty windows (`dirty_ticks / ticks`), while clean share remains separate (`green_ticks / ticks`).
- Report display filters out old money/cost sentences so stale generated narratives do not show dollar savings.

## Report summary behavior
- Overview shows a shorter regional report summary with a stats strip.
- The report narrative is rendered as readable paragraphs on the Reports page.
- Report text avoids markdown, em dashes, and money-saving claims in the visible UI.

## Regional data flow
- The 30s refresh loop calls `getLatestSummary`, `getGridCurrent`, `getGridHistory`, `getPowerBreakdown`, `getForecast`, `getRegionCompare`, and `getAllSummaries` for the selected region.
- `lastFetch` updates on each successful cycle so the live badge stays fresh.
- `getCurrent` and `getDecisions` remain exported but are not wired into the regional preview cards.

## Created components from redesign
- `frontend/src/components/GaugeMeter.jsx` - Arc, Ring, and Bar gauge variants.
- `frontend/src/components/TimelineChart.jsx` - SVG timeline with threshold line, dirty shading, and hover tooltip.
- `frontend/src/components/BatchStateCard.jsx` - Run/Pause recommendation with vCPU count and last-check time.
- `frontend/src/components/DecisionCounts.jsx` - Green, Dirty, and Clean share metrics.
- `frontend/src/components/AskNimbus.jsx` - Floating chat UI shell.

## Notes
- Default active scheme is AWS.
- SettingsPage keeps AWS, Google, and Forest theme options.
- `ForecastStrip` and `RegionCompareBanner` remain mounted in Overview and Timeline.
- No new npm packages were added.
