import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { invokeLLM } from "./_core/llm";

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  whiteboard: router({
    askAI: publicProcedure
      .input(
        z.object({
          question: z.string().min(1, "Question is required"),
          imageData: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { question, imageData } = input;

        try {
          const messages: any[] = [];

            if (imageData) {
            // Vision model with image
            const systemPrompt = `You are an AI assistant for an online whiteboard. Analyze the attached whiteboard image and respond in the following format:

1. Concise description of the current drawing (objectively describe what is drawn)
2. Answer to the user's question: ${question}

Provide specific and practical advice or answers to the user's question, taking into account the drawing content, in English.

IMPORTANT: When writing mathematical formulas, ALWAYS use LaTeX notation enclosed in dollar signs:
- For inline formulas, use single dollar signs: $formula$
- For display formulas, use double dollar signs: $$formula$$
- Examples: $f(x) = x^{0.5} \cdot y^{0.5}$ or $f'(x) = 0.5 \cdot x^{-0.5} \cdot y^{0.5}$

NOTE: Do NOT use markdown formatting like ** for bold text. Use plain text with clear line breaks instead.`;;

            messages.push({
              role: "user",
              content: [
                { type: "text", text: systemPrompt },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:image/png;base64,${imageData}`,
                  },
                },
              ],
            });
          } else {
            // Text-only question
            const systemPrompt = `You are an AI assistant for an online whiteboard. Please answer the user's question concisely in English.

Question: ${question}

If the question is about drawing, sketching, or organizing ideas, provide specific and practical advice.

IMPORTANT: When writing mathematical formulas, ALWAYS use LaTeX notation enclosed in dollar signs:
- For inline formulas, use single dollar signs: $formula$
- For display formulas, use double dollar signs: $$formula$$
- Examples: $f(x) = x^{0.5} \cdot y^{0.5}$ or $f'(x) = 0.5 \cdot x^{-0.5} \cdot y^{0.5}$

NOTE: Do NOT use markdown formatting like ** for bold text. Use plain text with clear line breaks instead.`;

            messages.push({
              role: "user",
              content: systemPrompt,
            });
          }

          const response = await invokeLLM({
            messages: messages as any,
          });

          const answer = response.choices[0]?.message?.content || "No response received";
          return { answer };
        } catch (error) {
          console.error("Error in askAI:", error);
          throw new Error("Failed to get AI response");
        }
      }),

    generateIdea: publicProcedure
      .input(
        z.object({
          imageData: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { imageData } = input;

        try {
          const messages: any[] = [];

          if (imageData) {
            // Develop existing drawing
            const prompt = `Analyze the attached whiteboard image and propose drawing ideas that build upon (complete) the current drawing.

Please respond in the following format:

1. Analysis of the current drawing (briefly describe what is drawn and its state)
2. Idea for development/completion (how to develop the current drawing)
3. Elements to add (colors, shapes, text, decorations, etc.)
4. Specific steps to completion (step-by-step explanation)

Provide practical advice in English to make the work more attractive and complete, while leveraging the good parts of the current drawing.

IMPORTANT: When writing mathematical formulas, ALWAYS use LaTeX notation enclosed in dollar signs:
- For inline formulas, use single dollar signs: $formula$
- For display formulas, use double dollar signs: $$formula$$

NOTE: Do NOT use markdown formatting like ** for bold text. Use plain text with clear line breaks instead.`;

            messages.push({
              role: "user",
              content: [
                { type: "text", text: prompt },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:image/png;base64,${imageData}`,
                  },
                },
              ],
            });
          } else {
            // Generate new idea
            const prompt = `Please suggest one creative idea for drawing on an online whiteboard. Include the following elements:

1. Drawing theme (e.g., landscape, abstract art, diagram, mind map, etc.)
2. Color suggestions
3. Drawing tips and points
4. Simple steps to completion

Please explain in English in a way that is easy for beginners to understand.

IMPORTANT: When writing mathematical formulas, ALWAYS use LaTeX notation enclosed in dollar signs:
- For inline formulas, use single dollar signs: $formula$
- For display formulas, use double dollar signs: $$formula$$

NOTE: Do NOT use markdown formatting like ** for bold text. Use plain text with clear line breaks instead.`;

            messages.push({
              role: "user",
              content: prompt,
            });
          }

          const response = await invokeLLM({
            messages: messages as any,
          });

          const idea = response.choices[0]?.message?.content || "No idea generated";
          return { idea };
        } catch (error) {
          console.error("Error in generateIdea:", error);
          throw new Error("Failed to generate drawing idea");
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;

