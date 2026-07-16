'use server';

/**
 * @fileOverview An AI agent that recommends similar products based on a given product description.
 *
 * - recommendSimilarProducts - A function that handles the recommendation process.
 * - RecommendSimilarProductsInput - The input type for the recommendSimilarProducts function.
 * - RecommendSimilarProductsOutput - The return type for the recommendSimilarProducts function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const RecommendSimilarProductsInputSchema = z.object({
  productDescription: z
    .string()
    .describe('The description of the product to find similar products for.'),
  numberOfRecommendations: z
    .number()
    .default(3)
    .describe('The number of similar products to recommend.'),
});
export type RecommendSimilarProductsInput = z.infer<typeof RecommendSimilarProductsInputSchema>;

const RecommendSimilarProductsOutputSchema = z.object({
  recommendedProducts: z
    .array(z.string())
    .describe('A list of product descriptions for the recommended products.'),
});
export type RecommendSimilarProductsOutput = z.infer<typeof RecommendSimilarProductsOutputSchema>;

export async function recommendSimilarProducts(input: RecommendSimilarProductsInput): Promise<RecommendSimilarProductsOutput> {
  return recommendSimilarProductsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'recommendSimilarProductsPrompt',
  input: {schema: RecommendSimilarProductsInputSchema},
  output: {schema: RecommendSimilarProductsOutputSchema},
  prompt: `You are a product recommendation expert. Given a product description, you will find similar products and return a list of product descriptions for the recommended products.

Product Description: {{{productDescription}}}

Please return {{numberOfRecommendations}} similar products.

Ensure that the products are different from each other and provide a variety of options.`,
});

const recommendSimilarProductsFlow = ai.defineFlow(
  {
    name: 'recommendSimilarProductsFlow',
    inputSchema: RecommendSimilarProductsInputSchema,
    outputSchema: RecommendSimilarProductsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
