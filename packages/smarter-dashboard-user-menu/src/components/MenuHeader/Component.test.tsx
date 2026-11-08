import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { appContext } from "@/mocks/fixtures";

import MenuHeader from "@/components/MenuHeader/Component";

describe("MenuHeader", () => {
  it("shows the profile image without a way to change it, when there is no file input", () => {
    render(
      <MenuHeader
        user={appContext.user}
        profileImageUrl={appContext.profileImageUrl}
        accountName={appContext.accountName}
        showAccount={false}
      />,
    );
    expect(screen.getByRole("img", { name: "Profile Image" })).toBeInTheDocument();
    expect(screen.queryByTitle("Change Profile Image")).not.toBeInTheDocument();
    expect(screen.queryByText(appContext.accountName)).not.toBeInTheDocument();
  });
});
