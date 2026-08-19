import { defineConfig } from "@playwright/test";

// End-to-end coverage for the content script only: the picker, the overlay,
// pin placement, and the top layer behaviour that fixtures in e2e/fixtures/
// are built to provoke.
//
// Specs load the extension themselves with chromium.launchPersistentContext
// and --load-extension pointing at dist/build, so there is no webServer here
// and no global browser reuse. Run `npm run build` first.
//
// The side panel is deliberately out of scope. Chrome's side panel is not
// practical to address from Playwright, and a faked one would not be testing
// anything. It is covered by the manual checklist in the repo instead.
export default defineConfig({
  testDir: "e2e",

  // A test that passes on retry has told you something. Keep it at zero.
  retries: 0,

  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],

  use: {
    trace: "retain-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
});
