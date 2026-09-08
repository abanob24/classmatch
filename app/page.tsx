import MatchForm from "../components/MatchForm";

export default function Home() {
  return (
    <main>
      <h1>ClassMatch</h1>
      <p>
        Describe what tutoring help your child needs — subject, grade, and when you're free —
        and we'll match you to a real available session.
      </p>
      <MatchForm />
    </main>
  );
}
