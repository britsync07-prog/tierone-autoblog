# Fixture Draft Outline: AI Writing Assistants
- H1 (50-60 chars): How the TierOne AutoBlog Draft Pipeline Works Day One
- Meta description (150-160 chars): The draft stage turns an outlined, image-ready registry entry into a template-conformant MDX post via zod frontmatter, stage assertions, and a template gate.
- TL;DR (<=100 words): The draft stage turns one outlined topic into a validated MDX file. This outline plans three structural beats: turning the model payload into frontmatter, running the stage assertions that guard the word band and headings, and landing the file only after the template gate reads it back.
- Silo: ai-writing

## Structure

## What lands as frontmatter — target ~400 words
The model returns a structured JSON payload whose title fills the post title, the description, the TL;DR line, and the question and answer block. Every value passes the shared draft schema before anything is written.

## How the assertions guard the body — target ~400 words
The stage re-checks the committed outline against the returned body. Headings must survive the trip, the word band must land inside its window, and each question must still belong to the observed set.

## Where the file lands and what gets recorded — target ~400 words
Only after every check passes does the MDX file get written and the registry entry advance. Failures record attempts and last error text honest enough for the next run to continue the trail.

## FAQs
- Q: Do AI writing tools hurt SEO rankings?
- Q: Which AI writing tool is best for beginners?
- Q: Can AI writing tools pass plagiarism checks?
- Q: How much should I pay for an AI writing assistant?

## Image slots
- hero: Fixture hero concept for the draft pipeline test entry (ALWAYS)
- in-article-1: none captured in the brief
- in-article-2: none captured in the brief
