import { createFileRoute } from '@tanstack/react-router'
import LearnEnglish from '../../pages/LearnEnglish'

export const Route = createFileRoute('/learn-english/$topicId/$stepNumber')({
  component: function LearnEnglishRoute() {
    const { topicId, stepNumber } = Route.useParams();
    return <LearnEnglish topicId={topicId} stepNumber={stepNumber} />;
  },
})
