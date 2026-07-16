'use server';

/**
 * @fileOverview This file defines a Genkit flow for generating compelling product descriptions from short, informal product notes.
 *
 * The flow takes a short product note as input and uses an LLM to generate a more detailed and engaging product description.
 *
 * @interface GenerateProductDescriptionInput - The input type for the generateProductDescription function.
 * @interface GenerateProductDescriptionOutput - The output type for the generateProductDescription function.
 * @function generateProductDescription - A function that takes GenerateProductDescriptionInput and returns a Promise of GenerateProductDescriptionOutput.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateProductDescriptionInputSchema = z.object({
  productNote: z
    .string()
    .describe('A short, informal note describing the product.'),
});

export type GenerateProductDescriptionInput = z.infer<
  typeof GenerateProductDescriptionInputSchema
>;

const GenerateProductDescriptionOutputSchema = z.object({
  productDescription: z
    .string()
    .describe('A compelling and detailed product description.'),
});

export type GenerateProductDescriptionOutput = z.infer<
  typeof GenerateProductDescriptionOutputSchema
>;

const generateProductDescriptionPrompt = ai.definePrompt({
  name: 'generateProductDescriptionPrompt',
  input: {schema: GenerateProductDescriptionInputSchema},
  output: {schema: GenerateProductDescriptionOutputSchema},
  prompt: `You are an expert copywriter specializing in creating compelling product descriptions. Based on the following informal product note, generate a detailed and engaging product description that will attract customers.

Product Note: {{{productNote}}}`,
});

const generateProductDescriptionFlow = ai.defineFlow(
  {
    name: 'generateProductDescriptionFlow',
    inputSchema: GenerateProductDescriptionInputSchema,
    outputSchema: GenerateProductDescriptionOutputSchema,
  },
  async input => {
    const {output} = await generateProductDescriptionPrompt(input);
    return output!;
  }
);

export async function generateProductDescription(
  input: GenerateProductDescriptionInput
): Promise<GenerateProductDescriptionOutput> {
  return generateProductDescriptionFlow(input);
}
