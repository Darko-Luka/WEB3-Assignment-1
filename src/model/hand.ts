import { Shuffler, standardShuffler } from "../utils/random_utils";
import * as deck from "../../src/model/deck";

export class Hand {
  private players: string[];
  private playerHands: deck.Card[][];
  public dealer: number;
  private shuffler?: Shuffler<deck.Card>;
  private cardsPerPlayer?: number; // TODO: 
  private _drawPile: deck.Deck;
  private _discardPile: deck.Deck;
  private _playerInTurn: number;
  private isReverse: boolean;
  private selectedColor?: deck.CardColor;

  constructor(
    players: string[],
    dealer: number,
    shuffler?: Shuffler<deck.Card>,
    cardsPerPlayer?: number
  ) {
    if (players.length < 2) throw new Error("Not enough player");
    if (players.length > 10) throw new Error("To many players");
    this.players = players;
    this.playerHands = Array.from({ length: players.length }, () => []);

    this.dealer = dealer;
    this.cardsPerPlayer = cardsPerPlayer;

    this._drawPile = deck.createInitialDeck();
    this._discardPile = new deck.Deck([]);

    this.shuffler = shuffler;
    this.shuffle();

    this._playerInTurn = dealer;
    this.isReverse = false;

    this.initialDealCards();
    this.nextPlayer();
  }

  player(index: number) {
    if (index < 0) throw new Error("Player index out of bounds");
    if (index >= this.players.length)
      throw new Error("Player index out of bounds");
    return this.players[index];
  }

  playerHand(index: number): deck.Card[] {
    if (index < 0) throw new Error("Player hand index out of bounds");
    if (index >= this.playerHands.length)
      throw new Error("Player hand index out of bounds");
    return this.playerHands[index];
  }

  discardPile(): deck.Deck {
    return this._discardPile;
  }

  drawPile(): deck.Deck {
    return this._drawPile;
  }

  playerInTurn(): number {
    return this._playerInTurn;
  }

  play(cardIndex: number, nextColor?: deck.CardColor) {
    if (!this.canPlay(cardIndex)) throw new Error("Can not play the card"); // Checks if the move is legal

    this.selectedColor = undefined;

    const cardToPlay = this.playerHand(this._playerInTurn)[cardIndex];
    if (cardToPlay.type === "WILD" || cardToPlay.type === "WILD DRAW") {
      this.selectedColor = nextColor; // Set the selected color for Wild and Wild Draw 4 cards
    }

    this._discardPile.push(cardToPlay); // Adds the played cared to the discard pile
    this.playerHand(this._playerInTurn).splice(cardIndex, 1); // Removes the played card from the players deck
    this.nextPlayer();
  }

  canPlay(cardIndex: number): boolean {
    if ( // Checks if the cardIndex is in bounds, otherwise return false
      cardIndex < 0 ||
      cardIndex >= this.playerHand(this._playerInTurn).length
    )
      return false;

    const cardToPlay = this.playerHand(this._playerInTurn)[cardIndex];
    const topDiscardCard = this.discardPile().top();

    if (this.selectedColor !== undefined) {
      topDiscardCard.color = this.selectedColor; // Override the top discard card color if a previous played has played a wild card and changed the color
      topDiscardCard.number = undefined
    }

    if (cardToPlay.type === "WILD DRAW") {
      // Check if the player has a card of the same color as the top discard card
      const hasMatchingColorCard = this.playerHand(this._playerInTurn).some(
        (card) => card.color === topDiscardCard.color
      );

      // The card can be played if there is no matching color card
      if (hasMatchingColorCard) {
        return false; // Illegal to play a Wild Draw 4 card if hand contains a card with the matching color
      }
      return true;
    }

    if (cardToPlay.type === "WILD") {
      return true; // Wild cards can always be played
    }

    // Check if the cardToPlay has the same color as the top discard card
    if (cardToPlay.color === topDiscardCard.color) {
      return true;
    }

    // Check if cardToPlay is a numbered card and has the same number as the top discard card
    if (
      cardToPlay.type === "NUMBERED" &&
      topDiscardCard.type === "NUMBERED" &&
      cardToPlay.number === topDiscardCard.number
    ) {
      return true;
    }

    // Special handling for reverse, skip, and draw cards
    // Checks if the type of the color is the same as the top discard card and allows the play
    if (
      cardToPlay.type === "REVERSE" ||
      cardToPlay.type === "SKIP" ||
      cardToPlay.type === "DRAW"
    ) {
      return (
        cardToPlay.color === topDiscardCard.color ||
        cardToPlay.type === topDiscardCard.type
      );
    }

    // If none of the above conditions are met, the card is not playable
    return false;
  }

  get playerCount(): number {
    return this.players.length;
  }

  private initialDealCards() {
    // Deal 7 cards to each player
    for (let i = 0; i < this.playerHands.length; i++) {
      this.nextPlayer();
      for (let j = 0; j < 7; j++) {
        const card = this._drawPile.deal();
        if (card) this.playerHand(this._playerInTurn).push(card);
      }
    }

    // Deal the first card to the discard pile
    let card = this._drawPile.deal();
    if (!card) return;

    // Ensure the first card is not WILD or WILD DRAW 4
    while (card.type === "WILD" || card.type === "WILD DRAW") {
      this._drawPile.push(card); // put it back in the pile
      this.shuffle(); // shuffle again
      card = this._drawPile.deal(); // draw a new card
      if (!card) return; // fail-safe
    }

    // Add the valid first card to the discard pile
    this._discardPile.push(card);

    // Special case handling for the first discard
    switch (card.type) {
      case "REVERSE":
        this.isReverse = true;
        break;
      case "SKIP":
        this.nextPlayer(); // skip the next player
        break;
      case "DRAW":
        const nextPlayer = this.playerHands[
          (this._playerInTurn + 1 + this.players.length) % this.players.length
        ];
        let test = this._drawPile.deal();
        if (test) nextPlayer.push(test);
        test = this._drawPile.deal();
        if (test) nextPlayer.push(test);
        this.nextPlayer(); // the player who draws also skips their turn
        break;
    }
  }

  private nextPlayer() {
    const range = this.players.length;

    if (this.isReverse)
      this._playerInTurn = (this._playerInTurn - 1 + range) % range;
    else this._playerInTurn = (this._playerInTurn + 1 + range) % range;
  }

  private shuffle() {
    if (this.shuffler) this._drawPile.shuffle(this.shuffler);
    else this._drawPile.shuffle(standardShuffler);
  }
}

export function createHand(
  players: string[],
  dealer: number,
  shuffler?: Shuffler<deck.Card>,
  cardsPerPlayer?: number
): Hand {
  const hand = new Hand(players, dealer, shuffler, cardsPerPlayer);
  return hand;
}
