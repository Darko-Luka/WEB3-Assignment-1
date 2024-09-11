import { Shuffler, standardShuffler, swapObjects } from "../utils/random_utils";
import * as deck from "../../src/model/deck";

type UnoFailure = {
  accuser: number;
  accused: number;
};

type EndCallback = (event: { winner: number }) => void;

export class Hand {
  private players: string[];
  private playerHands: deck.Card[][];
  private playerUnos: boolean[];
  public dealer: number;
  private shuffler?: Shuffler<deck.Card>;
  private cardsPerPlayer?: number;
  private _drawPile: deck.Deck;
  private _discardPile: deck.Deck;
  private _playerInTurn: number;
  private isReverse: boolean;
  private selectedColor?: deck.CardColor;
  private _score?: number;
  public endCallbacks: EndCallback[] = [];

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
    this.playerUnos = Array.from({ length: players.length }, () => false);

    this.dealer = dealer;
    this.cardsPerPlayer = cardsPerPlayer;

    this._drawPile = deck.createInitialDeck(() => this.onEmptyDrawDeck());
    this._discardPile = new deck.Deck([]);

    this.shuffler = shuffler;
    this.shuffle();

    this._playerInTurn = dealer;
    this.isReverse = false;

    this.initialDealCards();
    this.nextPlayer();
  }

  player(index: number): string {
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

  playerInTurn(): number | undefined {
    if (this.hasEnded()) return undefined;

    return this._playerInTurn;
  }

  play(cardIndex: number, nextColor?: deck.CardColor): deck.Card {
    if (!this.canPlay(cardIndex)) throw new Error("Can not play the card"); // Checks if the move is legal

    this.selectedColor = undefined;

    const cardToPlay = this.playerHand(this._playerInTurn)[cardIndex];

    // Check if the cardToPlay is not a Wild or Wild Draw card and check if the nextColor is provided
    if (
      !(cardToPlay.type === "WILD" || cardToPlay.type === "WILD DRAW") &&
      nextColor
    )
      throw Error("Cannot name a color on a colored card");

    if (cardToPlay.type === "WILD" || cardToPlay.type === "WILD DRAW") {
      if (!nextColor)
        throw Error("Next color is undefined but a wild card was played");
      this.selectedColor = nextColor; // Set the selected color for Wild and Wild Draw 4 cards
    }

    this._discardPile.push(cardToPlay); // Adds the played cared to the discard pile
    this.playerHand(this._playerInTurn).splice(cardIndex, 1); // Removes the played card from the players deck
    this.handleLogicForSpecialCards(cardToPlay);
    this.nextPlayer();
    this.hasEnded(); // Check if the game has ended
    return cardToPlay;
  }

  canPlay(cardIndex: number): boolean {
    if (this.hasEnded()) return false;

    if (
      // Checks if the cardIndex is in bounds, otherwise return false
      cardIndex < 0 ||
      cardIndex >= this.playerHand(this._playerInTurn).length
    )
      return false;

    const cardToPlay = this.playerHand(this._playerInTurn)[cardIndex];
    const topDiscardCard = this.discardPile().top();

    if (this.selectedColor !== undefined) {
      topDiscardCard.color = this.selectedColor; // Override the top discard card color if a previous played has played a wild card and changed the color
      topDiscardCard.number = undefined;
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

  canPlayAny(): boolean {
    for (
      let index = 0;
      index < this.playerHand(this._playerInTurn).length;
      index++
    ) {
      if (this.canPlay(index)) return true;
    }
    return false;
  }

  draw() {
    if (this.hasEnded()) throw Error("Cannot draw, the round has ended");

    const card = this._drawPile.deal();
    if (!card) return;

    this.playerHand(this._playerInTurn).push(card);
    this.playerUnos[this._playerInTurn] = false;

    // Move to a next player if there is no playable cards
    if (!this.canPlayAny()) this.nextPlayer();
  }

  sayUno(playerIndex: number) {
    if (this.hasEnded()) throw Error("Cannot say UNO, the round has ended");

    if (playerIndex < 0) throw new Error("Player hand index out of bounds");
    if (playerIndex >= this.playerHands.length)
      throw new Error("Player hand index out of bounds");

    if (
      this._playerInTurn === playerIndex ||
      this._playerInTurn === this.nextPlayerIndex(playerIndex)
    )
      this.playerUnos[playerIndex] = true;
  }

  catchUnoFailure(unoFailure: UnoFailure): boolean {
    const accusedPlayer = this.playerHands[unoFailure.accused];
    if (
      accusedPlayer.length === 1 &&
      !this.playerUnos[unoFailure.accused] &&
      (this._playerInTurn === unoFailure.accused ||
        this._playerInTurn === this.nextPlayerIndex(unoFailure.accused))
    ) {
      for (let index = 0; index < 4; index++) {
        let drawnCard = this._drawPile.deal();
        if (drawnCard) accusedPlayer.push(drawnCard);
      }
      return true;
    }

    return false;
  }

  score(): number | undefined {
    return this._score;
  }

  hasEnded(): boolean {
    for (let index = 0; index < this.playerHands.length; index++) {
      if (this.playerHand(index).length === 0) {
        this.calculateScore();
        const winner = this.winner();
        if (winner !== undefined)
          this.endCallbacks.forEach((callback) => callback({ winner }));
        return true;
      }
    }

    return false;
  }

  winner(): number | undefined {
    for (let index = 0; index < this.playerHands.length; index++) {
      if (this.playerHand(index).length === 0) return index;
    }

    return undefined;
  }

  public onEnd(callback: EndCallback): void {
    this.endCallbacks.push(callback);
  }

  get playerCount(): number {
    return this.players.length;
  }

  private initialDealCards() {
    // Deal 7 cards to each player
    for (let i = 0; i < this.playerHands.length; i++) {
      this.nextPlayer();
      for (let j = 0; j < (this?.cardsPerPlayer ?? 7); j++) {
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
    this.handleLogicForSpecialCards(card);
  }

  private calculateScore() {
    if (this._score !== undefined)
      // Do not calculate the score if the score has been calculated already!
      return;

    this._score = 0;

    for (let i = 0; i < this.playerHands.length; i++) {
      const hand = this.playerHand(i);
      for (let j = 0; j < hand.length; j++) {
        const card = hand[j];
        if (card.type === "NUMBERED" && card.number) this._score += card.number;
        if (card.type === "DRAW") this._score += 20;
        if (card.type === "REVERSE") this._score += 20;
        if (card.type === "SKIP") this._score += 20;
        if (card.type === "WILD") this._score += 50;
        if (card.type === "WILD DRAW") this._score += 50;
      }
    }
  }

  private nextPlayer() {
    this._playerInTurn = this.nextPlayerIndex();
  }

  private nextPlayerIndex(playerIndex?: number): number {
    const range = this.players.length;
    if (this.isReverse)
      return ((playerIndex ?? this._playerInTurn) - 1 + range) % range;
    else return ((playerIndex ?? this._playerInTurn) + 1 + range) % range;
  }

  private shuffle() {
    if (this.shuffler) this._drawPile.shuffle(this.shuffler);
    else this._drawPile.shuffle(standardShuffler);
  }

  private handleLogicForSpecialCards(card: deck.Card) {
    switch (card.type) {
      case "REVERSE":
        // If there is two players, reverse card acts like a skip card.
        if (this.playerCount === 2) this.nextPlayer();

        this.isReverse = !this.isReverse;
        break;
      case "SKIP":
        this.nextPlayer(); // skip the next player
        break;
      case "DRAW":
      case "WILD DRAW":
        const nextPlayer = this.playerHands[this.nextPlayerIndex()];
        // Deal ether 2 or 4 cards depending is it a normal Draw or Wild Draw
        for (let index = 0; index < (card.type === "DRAW" ? 2 : 4); index++) {
          let drawnCard = this._drawPile.deal();
          if (drawnCard) nextPlayer.push(drawnCard);
        }
        this.nextPlayer(); // the player who draws also skips their turn
        break;
    }
  }

  private onEmptyDrawDeck() {
    const topDiscardCard = this._discardPile.deal(); // Save the top card from the discard pile
    // Switch the discard and draw piles
    [this._drawPile, this._discardPile] = swapObjects(
      this._drawPile,
      this._discardPile
    );
    if (topDiscardCard) this._discardPile.push(topDiscardCard); // Put back the top card to the discard pile
    this.shuffle(); // Reshuffle the draw pile
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
