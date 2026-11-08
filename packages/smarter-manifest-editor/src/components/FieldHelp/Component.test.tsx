import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { fieldHelp } from "@/lib/schemaHelp";
import { SECRET_SCHEMA } from "@/mocks/fixtures";

import FieldHelp from "@/components/FieldHelp/Component";

describe("FieldHelp", () => {
  it("says how to get help without a field", () => {
    render(<FieldHelp help={null} />);
    expect(screen.getByText(/Move the cursor to a field/)).toBeInTheDocument();
  });

  it("shows a required field's path, type and description", () => {
    render(<FieldHelp help={fieldHelp(SECRET_SCHEMA, ["spec", "config", "value"])} />);
    const help = screen.getByLabelText("Field help");
    expect(help).toHaveTextContent("spec.config.value");
    expect(help).toHaveTextContent("string");
    expect(help).toHaveTextContent("required");
    expect(help).toHaveTextContent("The secret's value.");
  });

  it("shows an optional field's values", () => {
    render(<FieldHelp help={fieldHelp(SECRET_SCHEMA, ["spec", "config", "stage"])} />);
    const help = screen.getByLabelText("Field help");
    expect(help).not.toHaveTextContent("required");
    expect(help).toHaveTextContent("One of: dev, prod");
  });
});
