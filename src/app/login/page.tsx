import LoginForm from "./LoginForm";

export default async function LoginPage(props: PageProps<"/login">) {
  const searchParams = await props.searchParams;
  const error = typeof searchParams.error === "string" ? searchParams.error : undefined;

  // The landing page's "Sign up" buttons link here with ?mode=signup, so they
  // open the tab they promised rather than dropping the visitor on the login
  // form. Anything else falls back to logging in.
  const mode = searchParams.mode === "signup" ? "signup" : "login";

  return <LoginForm initialError={error} initialMode={mode} />;
}
