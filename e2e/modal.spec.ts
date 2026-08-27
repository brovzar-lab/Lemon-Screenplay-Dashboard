import { test, expect } from './fixtures';

test.setTimeout(90_000);

test.describe('Project workspace and fallback drawer', () => {
  test('Screenplay File shell follows the active light or dark theme', async ({ page }) => {
    await page.goto('/projects/synthetic-romance?workspace=screenplay');
    const workspace = page.getByTestId('screenplay-file-workspace');
    await expect(workspace).toBeVisible({ timeout: 30_000 });

    const colors = await workspace.evaluate((element) => {
      const style = getComputedStyle(element);
      const hero = element.querySelector<HTMLElement>('.screenplay-file__hero');
      const binder = element.querySelector<HTMLElement>('.screenplay-file__binder');
      const probe = (token: string) => {
        const themeProbe = document.createElement('span');
        themeProbe.style.background = `var(${token})`;
        element.appendChild(themeProbe);
        const value = getComputedStyle(themeProbe).backgroundColor;
        themeProbe.remove();
        return value;
      };
      return {
        shell: style.backgroundColor,
        canvas: probe('--dsc-bg'),
        surface: probe('--dsc-surface'),
        hero: hero ? getComputedStyle(hero).backgroundColor : '',
        binder: binder ? getComputedStyle(binder).backgroundColor : '',
      };
    });

    expect(colors.shell).toBe(colors.canvas);
    expect(colors.hero).toBe(colors.surface);
    expect(colors.binder).toBe(colors.surface);
  });

  test('all six Screenplay File tabs remain connected', async ({ page }) => {
    await page.goto('/projects/synthetic-romance?workspace=screenplay');
    await expect(page.getByRole('tab', { name: 'Overview' })).toBeVisible({ timeout: 30_000 });

    for (const tab of ['Scores', 'Reader Room', 'Story X-Ray', 'Producer Take', 'Notes']) {
      await page.getByRole('tab', { name: tab, exact: true }).click();
      await expect(page.getByRole('tab', { name: tab, exact: true })).toHaveAttribute(
        'aria-selected',
        'true',
      );
    }
  });

  test('legacy drawer still opens and Escape restores Discovery', async ({ page }) => {
    await page.goto('/discover?ui=screenplay&preview=drawer');
    await expect(page.getByTestId('screenplay-discovery-result').first()).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('screenplay-discovery-result').first().locator('button.screenplay-wall__open').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page).toHaveURL(/\/discover\?ui=screenplay&preview=drawer/);
  });
});
