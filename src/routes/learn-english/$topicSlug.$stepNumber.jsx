import { createFileRoute } from '@tanstack/react-router'
import LearnEnglish from '../../pages/LearnEnglish'

export const Route = createFileRoute('/learn-english/$topicSlug/$stepNumber')({
  component: function LearnEnglishRoute() {
    const { topicSlug, stepNumber } = Route.useParams();
    return <LearnEnglish topicSlug={topicSlug} stepNumber={stepNumber} />;
  },
})
