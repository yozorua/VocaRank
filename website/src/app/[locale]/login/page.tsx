import { redirect } from 'next/navigation';

// The login page is no longer needed — Google sign-in is handled
// via the AuthButton in the Navbar, which calls signIn("google") directly.
// Redirect anyone who lands here to the home page.
export default function LoginPage() {
    redirect('/');
}
