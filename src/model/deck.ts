import { CardPredicate } from "../../__test__/utils/predicates";
import { Shuffler } from "../utils/random_utils";

export type CardType =
  | "SKIP"
  | "NUMBERED"
  | "REVERSE"
  | "DRAW"
  | "WILD"
  | "WILD DRAW";
export type CardColor = "BLUE" | "GREEN" | "RED" | "YELLOW";
export const colors: CardColor[] = ["BLUE", "GREEN", "RED", "YELLOW"];

export interface Card {
  type: CardType;
  color?: CardColor;
  number?: number;
}

export class Deck {
  private cards: Card[];
  private onDeckEmpty?: () => void

  constructor(cards: Card[], onDeckEmpty?: ()=> void) {
    this.cards = cards;
    this.onDeckEmpty = onDeckEmpty
  }

  // Shuffles the cards array
  shuffle(shuffler: Shuffler<Card>) {
    shuffler(this.cards);
  }

  // Creates a new copy of the deck and performs the CardPredicate comparison
  // to filter the new deck object, then it returns the new deck object
  filter(is: CardPredicate): Deck {
    const newDeck = new Deck(this.cards);
    newDeck.cards = newDeck.cards.filter((card) => {
      return is(card);
    });

    return newDeck;
  }

  // Removes the first card from the cards array
  deal(): Card | undefined  {
    const dealCard = this.cards.shift();
    if(this.cards.length === 0)
      this.onDeckEmpty?.()
    return dealCard
  }

  push(card: Card): void {
    this.cards.unshift(card)
  }

  top(): Card {
    return this.cards[0]
  }

  get size(): number {
    return this.cards.length;
  }

  // Converts the cards array to readable string format
  toString(): string {
    let string = "";

    this.cards.forEach((card) => {
      string += card.type + " " + card.color + " " + card.number + "\n";
    });

    return string;
  }
}

// Create's the full deck of 108 cards
export function createInitialDeck(onDeckEmpty?: ()=> void): Deck {
  const deck: Card[] = [];

  // Color cards
  colors.forEach((color) => {
    for (let index = 0; index < 10; index++) {
      deck.push({ type: "NUMBERED", color, number: index });
      if (index != 0) deck.push({ type: "NUMBERED", color, number: index });
    }
  });

  // Skip, Reverse and Draw cards
  colors.forEach((color) => {
    for (let index = 0; index < 2; index++) {
      deck.push({ type: "SKIP", color, number: undefined });
      deck.push({ type: "REVERSE", color, number: undefined });
      deck.push({ type: "DRAW", color, number: undefined });
    }
  });

  // Wild cards
  for (let index = 0; index < 4; index++) {
    deck.push({ type: "WILD", color: undefined, number: undefined });
    deck.push({ type: "WILD DRAW", color: undefined, number: undefined });
  }

  return new Deck(deck, onDeckEmpty);
}
