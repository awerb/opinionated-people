import { expect, test, type Page } from "@playwright/test";

const addPlayer = async (page: Page, name: string) => {
  await page.getByLabel("Player name").fill(name);
  await page.getByTestId("add-player").click();
};

test.describe("Opinionated People game flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("enforces minimum player count before starting", async ({ page }) => {
    const startButton = page.getByTestId("start-round");
    await expect(startButton).toBeDisabled();

    await addPlayer(page, "Alex");
    await expect(startButton).toBeDisabled();

    await addPlayer(page, "Jamie");
    await expect(startButton).toBeDisabled();

    await addPlayer(page, "River");
    await expect(startButton).toBeEnabled();
  });

  test("surfaces tie messaging when multiple leaders share the score", async ({ page }) => {
    await addPlayer(page, "Alex");
    await addPlayer(page, "Jamie");
    await addPlayer(page, "River");

    await page.getByTestId("start-round").click();
    await page.getByTestId("score-Alex").click();
    await page.getByTestId("score-Jamie").click();

    await expect(page.getByTestId("score-status")).toContainText("It's a tie");
    await expect(page.getByTestId("tie-message")).toBeVisible();
  });

  test("announces timer expiry after the round clock runs out", async ({ page }) => {
    await addPlayer(page, "Alex");
    await addPlayer(page, "Jamie");
    await addPlayer(page, "River");

    await page.getByTestId("start-round").click();
    await expect(page.getByTestId("timer-display")).toContainText("s remaining");
    await expect(page.getByTestId("timer-display")).toHaveText(/Timer idle/, { timeout: 7000 });
    await expect(page.getByTestId("lobby-status")).toContainText("Timer expired");
  });

  test("tracks invite lifecycle", async ({ page }) => {
    await page.getByLabel("Invite email").fill("caster@example.com");
    await page.getByTestId("send-invite").click();
    const inviteRow = page.getByText("caster@example.com", { exact: false });
    await expect(inviteRow).toContainText("pending");
    await page.getByTestId("accept-caster@example.com").click();
    await expect(inviteRow).toContainText("accepted");
  });

  test("walks through the championship stages", async ({ page }) => {
    await addPlayer(page, "Alex");
    await addPlayer(page, "Jamie");
    await addPlayer(page, "River");

    const stage = page.getByTestId("championship-stage");
    await expect(stage).toContainText("Qualifiers");

    const advance = page.getByTestId("advance-stage");
    await advance.click();
    await expect(stage).toContainText("Semifinals");

    await page.getByTestId("start-round").click();
    await page.getByTestId("score-River").click();
    await page.getByTestId("score-River").click();

    await advance.click();
    await expect(stage).toContainText("Final Showdown");
    await advance.click();
    await expect(stage).toContainText("Champion Crowned");
    await expect(page.getByTestId("champion-callout")).toContainText("River");
  });
});
