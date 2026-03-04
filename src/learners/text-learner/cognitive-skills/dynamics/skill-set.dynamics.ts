import * as avoids from './skill.avoids'
import * as fades from './skill.fades'
import * as intensifies from './skill.intensifies'
import * as recurs from './skill.recurs'
import * as shifts from './skill.shifts'

export const skillSet = {
	name: 'dynamics',
	question: 'What patterns do I notice in how information arrives?',
}

export const skills = {
	recurs,
	intensifies,
	fades,
	shifts,
	avoids,
}
