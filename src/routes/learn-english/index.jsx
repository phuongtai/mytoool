import { createFileRoute } from '@tanstack/react-router'
import LearnEnglish from '../../pages/LearnEnglish'

export const Route = createFileRoute('/learn-english/')({
  component: LearnEnglish,
})
