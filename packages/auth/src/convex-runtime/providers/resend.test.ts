import { describe, expect, it } from "vitest";
import { createResendEmailOtpSender, createResendEmailSender } from "./resend.js";

type CapturedRequest = {
  url: string;
  init: RequestInit;
};

function makeFetch(returnId: string, status = 200) {
  return async (url: string, init: RequestInit) => {
    const request = { url, init } as CapturedRequest;
    return {
      ok: status >= 200 && status < 300,
      status,
      text: async () => "",
      json: async () => ({ id: returnId }),
      request,
    } as unknown as Response;
  };
}

function captureFetch() {
  let captured: CapturedRequest | undefined;
  const fetch = async (url: string, init: RequestInit) => {
    captured = { url, init };
    return {
      ok: true,
      status: 200,
      text: async () => "",
      json: async () => ({ id: "test-email-id" }),
    } as unknown as Response;
  };
  return { fetch, getRequest: () => captured };
}

describe("createResendEmailSender", () => {
  it("sends an email with the Resend API", async () => {
    const { fetch, getRequest } = captureFetch();
    const send = createResendEmailSender({
      apiKey: "re_123",
      from: "auth@example.com",
      fetch,
    });

    const emailId = await send({
      from: "auth@example.com",
      to: "user@example.com",
      subject: "Hello",
      html: "<p>Hi</p>",
      text: "Hi",
    });

    expect(emailId).toBe("test-email-id");
    const request = getRequest();
    expect(request).toBeDefined();
    expect(request!.url).toBe("https://api.resend.com/emails");
    expect(request!.init.method).toBe("POST");
    expect(request!.init.headers).toMatchObject({
      Authorization: "Bearer re_123",
      "Content-Type": "application/json",
    });

    const body = JSON.parse(request!.init.body as string);
    expect(body).toEqual({
      from: "auth@example.com",
      to: "user@example.com",
      subject: "Hello",
      html: "<p>Hi</p>",
      text: "Hi",
    });
  });

  it("falls back to the default from address", async () => {
    const { fetch, getRequest } = captureFetch();
    const send = createResendEmailSender({
      apiKey: "re_123",
      from: "default@example.com",
      fetch,
    });

    await send({
      from: "",
      to: "user@example.com",
      subject: "Hello",
      html: "<p>Hi</p>",
      text: "Hi",
    });

    const body = JSON.parse(getRequest()!.init.body as string);
    expect(body.from).toBe("default@example.com");
  });

  it("throws when no from address is available", async () => {
    const send = createResendEmailSender({
      apiKey: "re_123",
      fetch: makeFetch(""),
    });

    await expect(
      send({
        from: "",
        to: "user@example.com",
        subject: "Hello",
        html: "<p>Hi</p>",
        text: "Hi",
      }),
    ).rejects.toThrow("Resend sender requires a 'from' address");
  });

  it("throws on non-2xx responses", async () => {
    const fetch = async () =>
      ({
        ok: false,
        status: 422,
        text: async () => '{"error":"invalid_from_address"}',
      }) as unknown as Response;

    const send = createResendEmailSender({
      apiKey: "re_123",
      from: "auth@example.com",
      fetch,
    });

    await expect(
      send({
        from: "auth@example.com",
        to: "user@example.com",
        subject: "Hello",
        html: "<p>Hi</p>",
        text: "Hi",
      }),
    ).rejects.toThrow("Resend email send failed (422)");
  });
});

describe("createResendEmailOtpSender", () => {
  it("sends an OTP email with a default template", async () => {
    const { fetch, getRequest } = captureFetch();
    const send = createResendEmailOtpSender({
      apiKey: "re_123",
      from: "auth@example.com",
      fetch,
    });

    const emailId = await send({ email: "user@example.com", otp: "123456", type: "sign-in" });

    expect(emailId).toBe("test-email-id");
    const request = getRequest();
    const body = JSON.parse(request!.init.body as string);
    expect(body.to).toBe("user@example.com");
    expect(body.subject).toBe("Your sign-in code");
    expect(body.html).toContain("123456");
    expect(body.text).toContain("123456");
  });

  it("uses custom builders", async () => {
    const { fetch, getRequest } = captureFetch();
    const send = createResendEmailOtpSender({
      apiKey: "re_123",
      from: "auth@example.com",
      fetch,
      buildSubject: (type) => `[${type}] code`,
      buildHtml: (otp) => `<b>${otp}</b>`,
      buildText: (otp) => `code: ${otp}`,
    });

    await send({ email: "user@example.com", otp: "987654", type: "reset" });

    const body = JSON.parse(getRequest()!.init.body as string);
    expect(body.subject).toBe("[reset] code");
    expect(body.html).toBe("<b>987654</b>");
    expect(body.text).toBe("code: 987654");
  });
});
